import os
import time
import boto3
from sqlalchemy.orm import Session
from app.models.aws_setup_state import AWSSetupState
from botocore.exceptions import ClientError

def run_aws_setup(db: Session, allowed_ssh_cidr: str = "0.0.0.0/0", log_callback=None):
    if not log_callback:
        log_callback = lambda step, msg: None

    sts = boto3.client('sts')
    ec2 = boto3.client('ec2', region_name=os.getenv("AWS_REGION", "us-east-1"))

    # Step 1: Validate IAM Permissions
    log_callback("step1", "Validating IAM permissions...")
    try:
        sts.get_caller_identity()
    except ClientError as e:
        raise RuntimeError(f"IAM validation failed: {e}")

    try:
        ec2.describe_instances(DryRun=True)
    except ClientError as e:
        if e.response['Error'].get('Code') != 'DryRunOperation':
            raise RuntimeError(f"EC2 permissions validation failed: {e}")

    # Step 2: Detect or Select VPC and Subnet
    log_callback("step2", "Detecting VPC and Subnet...")
    vpcs = ec2.describe_vpcs().get('Vpcs', [])
    default_vpc = next((vpc for vpc in vpcs if vpc.get('IsDefault')), None)
    
    if not default_vpc:
        if not vpcs:
            raise RuntimeError("No VPC found. Please create a default VPC in AWS.")
        vpc_id = vpcs[0]['VpcId']
    else:
        vpc_id = default_vpc['VpcId']

    subnets = ec2.describe_subnets(Filters=[{'Name': 'vpc-id', 'Values': [vpc_id]}]).get('Subnets', [])
    public_subnet = next((s for s in subnets if s.get('MapPublicIpOnLaunch')), None)
    if not public_subnet:
        if subnets:
            public_subnet = subnets[0]
        else:
            raise RuntimeError(f"No subnets found in VPC {vpc_id}")
            
    subnet_id = public_subnet['SubnetId']

    # Step 3: Create Security Group
    log_callback("step3", "Creating Security Group...")
    timestamp = int(time.time())
    sg_name = f"cloudforge-sg-{timestamp}"
    
    try:
        res = ec2.create_security_group(
            GroupName=sg_name,
            Description="CloudForge managed - auto-created by setup wizard",
            VpcId=vpc_id
        )
        sg_id = res['GroupId']
        
        ec2.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=[
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 22,
                    'ToPort': 22,
                    'IpRanges': [{'CidrIp': allowed_ssh_cidr}]
                },
                {
                    'IpProtocol': 'tcp',
                    'FromPort': 8000,
                    'ToPort': 8099,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
                }
            ]
        )
    except ClientError as e:
        raise RuntimeError(f"Failed to create/configure Security Group: {e}")

    # Step 4: Create Key Pair
    log_callback("step4", "Creating Key Pair...")
    key_name = f"cloudforge-key-{timestamp}"
    try:
        key_res = ec2.create_key_pair(KeyName=key_name)
        key_material = key_res['KeyMaterial']
        
        # Save to <project_root>/keys/
        keys_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "keys"))
        os.makedirs(keys_dir, exist_ok=True)
        key_path = os.path.join(keys_dir, f"{key_name}.pem")
        
        with open(key_path, "w") as f:
            f.write(key_material)
        
        if os.name == 'posix':
            os.chmod(key_path, 0o600)
    except ClientError as e:
        raise RuntimeError(f"Failed to create Key Pair: {e}")

    # Step 5: Detect AMI
    log_callback("step5", "Detecting AMI...")
    try:
        images = ec2.describe_images(
            Filters=[
                {'Name': 'name', 'Values': ['ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-*']},
                {'Name': 'state', 'Values': ['available']},
                {'Name': 'architecture', 'Values': ['x86_64']}
            ],
            Owners=['amazon']
        ).get('Images', [])
        
        if not images:
            raise RuntimeError("No suitable Ubuntu Jammy AMI found.")
            
        images.sort(key=lambda x: x['CreationDate'], reverse=True)
        ami_id = images[0]['ImageId']
    except ClientError as e:
        raise RuntimeError(f"Failed to detect AMI: {e}")

    # Step 6: Persist and Apply
    log_callback("step6", "Persisting state...")
    state = db.query(AWSSetupState).first()
    if not state:
        state = AWSSetupState()
        db.add(state)
        
    state.security_group_id = sg_id
    state.key_pair_name = key_name
    state.ssh_key_path = key_path
    state.ami_id = ami_id
    state.subnet_id = subnet_id
    state.iam_validated = True
    state.setup_status = 'complete'
    state.error_detail = None
    
    db.commit()
    
    log_callback("complete", "AWS Setup finished successfully.")
    return state
