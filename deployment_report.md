# Deployment Report — mern

**Generated:** 2026-08-18 20:18:24
**Status:** live

## Project
- **Name:** mern
- **Framework:** mern
- **Deployment Type:** mern
- **Source:** ZIP upload

## Infrastructure

- **EC2 Instance:** i-0503309f7da4219b5
- **Public IP:** 3.84.100.121
- **Instance Type:** 
- **Region:** us-east-1
- **Provisioning Action:** reused


## Services
| Service | Image Tag | Port | Status |
|---------|-----------|------|--------|

| cloudforge-64-client | cloudforge-64-client:66 | 80 | running |

| cloudforge-64-server | cloudforge-64-server:66 | internal | running |


## Timeline
| Stage | Timestamp | Detail |
|-------|-----------|--------|

|  | 2026-08-18 20:17:02 | Resolving a CloudForge-managed EC2 instance |

|  | 2026-08-18 20:17:08 | Detecting the uploaded project framework |

|  | 2026-08-18 20:17:08 | Building mern deployment image(s) |

|  | 2026-08-18 20:17:08 | Transferring and starting deployment containers |


## Health Check

- **Method:** TCP
- **Response Time:** 120 ms
- **Result:** failed -> rolled_back




## Environment Variables (keys only)


## Access

- **App URL:** http://3.84.100.121:80
