from app.db.session import SessionLocal
from app.models.aws_setup_state import AWSSetupState

db = SessionLocal()
s = db.query(AWSSetupState).first()
if s:
    print("setup_status:", s.setup_status)
    print("iam_validated:", s.iam_validated)
    print("security_group_id:", s.security_group_id)
    print("key_pair_name:", s.key_pair_name)
    print("ami_id:", s.ami_id)
    print("subnet_id:", s.subnet_id)
    print("ssh_key_path:", s.ssh_key_path)
else:
    print("No aws_setup_state row found")
