"""Seed Script: 45 Diverse Indian Borrowers with complete loan files.

Populates realistic Indian applicants, applications, documents, risk assessments,
decisions, and audit trails across diverse Indian cities, employment profiles,
and all 6 FSM stages.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.core.security import get_password_hash
from app.database import async_session_factory
from app.models.application import ApplicationStatus, LoanApplication
from app.models.audit_log import AuditLog
from app.models.decision import DecisionType, LoanDecision
from app.models.document import ApplicationDocument, DocumentType, DocumentVerificationStatus
from app.models.loan_product import LoanProduct
from app.models.risk_assessment import RiskAssessment, RiskTier, UnderwritingRecommendation
from app.models.user import User, UserRole
from app.services.financial_engine import calculate_disposable_income, calculate_dti, calculate_emi

# 45 Diverse Indian Borrowers data definition
INDIAN_BORROWERS: List[Dict[str, Any]] = [
    {
        "first_name": "Aarav",
        "last_name": "Sharma",
        "email": "aarav.sharma@gmail.com",
        "phone": "+919811234501",
        "pan": "AAAPS1201A",
        "city": "New Delhi, Delhi",
        "address": "42 Barakhamba Road, Connaught Place",
        "employer": "Tata Consultancy Services",
        "title": "Lead Software Architect",
        "income": 185000,
        "existing_debt": 22000,
        "credit_score": 792,
        "product_code": "HOME_PRIME",
        "amount": 4500000,
        "tenor": 180,
        "purpose": "Purchase of 3BHK flat in Dwarka Expressway",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Priya",
        "last_name": "Nair",
        "email": "priya.nair@outlook.com",
        "phone": "+919820345602",
        "pan": "BBVPN2302B",
        "city": "Bengaluru, Karnataka",
        "address": "15/B 100 Feet Rd, Indiranagar",
        "employer": "Infosys Ltd",
        "title": "Senior Project Manager",
        "income": 145000,
        "existing_debt": 18000,
        "credit_score": 765,
        "product_code": "PERSONAL_FLEX",
        "amount": 800000,
        "tenor": 36,
        "purpose": "Home renovation and modular kitchen setup",
        "status": ApplicationStatus.UNDER_REVIEW,
    },
    {
        "first_name": "Rajesh",
        "last_name": "Iyer",
        "email": "rajesh.iyer@gmail.com",
        "phone": "+919840456703",
        "pan": "CCKRI3403C",
        "city": "Chennai, Tamil Nadu",
        "address": "77 Luz Church Road, Mylapore",
        "employer": "Zoho Corporation",
        "title": "Staff Infrastructure Engineer",
        "income": 160000,
        "existing_debt": 15000,
        "credit_score": 810,
        "product_code": "HOME_PRIME",
        "amount": 3500000,
        "tenor": 120,
        "purpose": "Residential plot construction in OMR corridor",
        "status": ApplicationStatus.DISBURSED,
    },
    {
        "first_name": "Sunita",
        "last_name": "Sen",
        "email": "sunita.sen@yahoo.co.in",
        "phone": "+919830567804",
        "pan": "DDPSS4504D",
        "city": "Kolkata, West Bengal",
        "address": "28 Southern Avenue, Lake Gardens",
        "employer": "Sen & Associates Healthcare",
        "title": "Chief Clinical Biochemist",
        "income": 120000,
        "existing_debt": 12000,
        "credit_score": 745,
        "product_code": "PERSONAL_FLEX",
        "amount": 500000,
        "tenor": 24,
        "purpose": "Medical diagnostics lab equipment upgrade",
        "status": ApplicationStatus.DOCUMENTS_VERIFIED,
    },
    {
        "first_name": "Vikramaditya",
        "last_name": "Rao",
        "email": "vikram.rao@gmail.com",
        "phone": "+919849678905",
        "pan": "EEVVR5605E",
        "city": "Hyderabad, Telangana",
        "address": "8-2-293 Banjara Hills Road No 14",
        "employer": "Dr. Reddy's Laboratories",
        "title": "Principal Formulation Scientist",
        "income": 210000,
        "existing_debt": 35000,
        "credit_score": 778,
        "product_code": "SME_GROWTH",
        "amount": 2500000,
        "tenor": 48,
        "purpose": "Expansion of contract analytical testing facility",
        "status": ApplicationStatus.RISK_ASSESSED,
    },
    {
        "first_name": "Meera",
        "last_name": "Kulkarni",
        "email": "meera.kulkarni@gmail.com",
        "phone": "+919822789006",
        "pan": "FFPMK6706F",
        "city": "Pune, Maharashtra",
        "address": "104 FC Road, Shivaji Nagar",
        "employer": "Persistent Systems",
        "title": "Technical Specialist",
        "income": 115000,
        "existing_debt": 10000,
        "credit_score": 752,
        "product_code": "PERSONAL_FLEX",
        "amount": 400000,
        "tenor": 36,
        "purpose": "Higher education certification course funding",
        "status": ApplicationStatus.SUBMITTED,
    },
    {
        "first_name": "Arjun",
        "last_name": "Reddy",
        "email": "arjun.reddy@gmail.com",
        "phone": "+919848890107",
        "pan": "GGPAR7807G",
        "city": "Hyderabad, Telangana",
        "address": "401 Jubilee Hills Road No 36",
        "employer": "Reddy Precision Forgings",
        "title": "Managing Partner",
        "income": 290000,
        "existing_debt": 45000,
        "credit_score": 820,
        "product_code": "SME_GROWTH",
        "amount": 4500000,
        "tenor": 60,
        "purpose": "CNC 5-axis vertical machining center acquisition",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Ananya",
        "last_name": "Chatterjee",
        "email": "ananya.chatterjee@gmail.com",
        "phone": "+919831901208",
        "pan": "HHPAC8908H",
        "city": "Kolkata, West Bengal",
        "address": "12 Ballygunge Circular Road",
        "employer": "Cognizant Technology Solutions",
        "title": "Associate Director",
        "income": 175000,
        "existing_debt": 25000,
        "credit_score": 788,
        "product_code": "HOME_PRIME",
        "amount": 4200000,
        "tenor": 180,
        "purpose": "Apartment purchase in New Town Action Area II",
        "status": ApplicationStatus.UNDER_REVIEW,
    },
    {
        "first_name": "Harpreet",
        "last_name": "Singh",
        "email": "harpreet.singh@gmail.com",
        "phone": "+919814012309",
        "pan": "IIJHS9009I",
        "city": "Chandigarh, Punjab",
        "address": "Sector 9-D, Madhya Marg",
        "employer": "Kisan Agrotech Pvt Ltd",
        "title": "Director of Supply Chain",
        "income": 195000,
        "existing_debt": 28000,
        "credit_score": 770,
        "product_code": "SME_GROWTH",
        "amount": 3000000,
        "tenor": 48,
        "purpose": "Cold storage unit installation and fleet upgrade",
        "status": ApplicationStatus.DISBURSED,
    },
    {
        "first_name": "Deepika",
        "last_name": "Joshi",
        "email": "deepika.joshi@gmail.com",
        "phone": "+919829123410",
        "pan": "JJPDS0110J",
        "city": "Jaipur, Rajasthan",
        "address": "52 Malviya Nagar, JLN Marg",
        "employer": "Rajasthan State Handloom Dev Corp",
        "title": "Senior Design Consultant",
        "income": 95000,
        "existing_debt": 8000,
        "credit_score": 735,
        "product_code": "PERSONAL_FLEX",
        "amount": 350000,
        "tenor": 24,
        "purpose": "Artisanal textile workshop renovation",
        "status": ApplicationStatus.DOCUMENTS_PENDING,
    },
    {
        "first_name": "Rohan",
        "last_name": "Deshmukh",
        "email": "rohan.deshmukh@gmail.com",
        "phone": "+919821234511",
        "pan": "KKPRD1211K",
        "city": "Mumbai, Maharashtra",
        "address": "Flat 14B, Sea Green Towers, Worli",
        "employer": "Morgan Stanley India",
        "title": "Vice President - Risk Analytics",
        "income": 320000,
        "existing_debt": 50000,
        "credit_score": 825,
        "product_code": "HOME_PRIME",
        "amount": 8500000,
        "tenor": 240,
        "purpose": "Luxury 3BHK flat in Wadala development",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Kavita",
        "last_name": "Pillai",
        "email": "kavita.pillai@gmail.com",
        "phone": "+919846345612",
        "pan": "LLPKP2312L",
        "city": "Kochi, Kerala",
        "address": "Marine Drive Waterfront Enclave",
        "employer": "Cochin Shipyard Ltd",
        "title": "Senior Marine Engineer",
        "income": 130000,
        "existing_debt": 14000,
        "credit_score": 760,
        "product_code": "HOME_PRIME",
        "amount": 3200000,
        "tenor": 144,
        "purpose": "Waterfront duplex construction in Kakkanad",
        "status": ApplicationStatus.RISK_ASSESSED,
    },
    {
        "first_name": "Aditya",
        "last_name": "Verma",
        "email": "aditya.verma@gmail.com",
        "phone": "+919839456713",
        "pan": "MMPAV3413M",
        "city": "Lucknow, Uttar Pradesh",
        "address": "B-18 Gomti Nagar, Vibhuti Khand",
        "employer": "HCL Technologies",
        "title": "Principal Technical Lead",
        "income": 125000,
        "existing_debt": 15000,
        "credit_score": 740,
        "product_code": "PERSONAL_FLEX",
        "amount": 600000,
        "tenor": 36,
        "purpose": "Family medical emergency consolidation",
        "status": ApplicationStatus.SUBMITTED,
    },
    {
        "first_name": "Sneha",
        "last_name": "Patel",
        "email": "sneha.patel@gmail.com",
        "phone": "+919825567814",
        "pan": "NNPSP4514N",
        "city": "Ahmedabad, Gujarat",
        "address": "402 Sindhu Bhavan Marg, Bodakdev",
        "employer": "Zydus Lifesciences",
        "title": "Regulatory Affairs Manager",
        "income": 140000,
        "existing_debt": 16000,
        "credit_score": 772,
        "product_code": "HOME_PRIME",
        "amount": 3800000,
        "tenor": 180,
        "purpose": "Residential bungalow purchase near SG Highway",
        "status": ApplicationStatus.DOCUMENTS_VERIFIED,
    },
    {
        "first_name": "Karthik",
        "last_name": "Subramanian",
        "email": "karthik.subramanian@gmail.com",
        "phone": "+919880678915",
        "pan": "OOPKS5615O",
        "city": "Bengaluru, Karnataka",
        "address": "78 HSR Layout Sector 4",
        "employer": "Flipkart Internet Pvt Ltd",
        "title": "Principal Product Manager",
        "income": 260000,
        "existing_debt": 38000,
        "credit_score": 805,
        "product_code": "HOME_PRIME",
        "amount": 6500000,
        "tenor": 180,
        "purpose": "Villa acquisition in Sarjapur Road",
        "status": ApplicationStatus.DISBURSED,
    },
    {
        "first_name": "Pooja",
        "last_name": "Agarwal",
        "email": "pooja.agarwal@gmail.com",
        "phone": "+919826789016",
        "pan": "PPQPA6716P",
        "city": "Indore, Madhya Pradesh",
        "address": "88 Vijay Nagar, AB Road",
        "employer": "Agarwal Agro Trading Co",
        "title": "Partner - Finance & Logistics",
        "income": 155000,
        "existing_debt": 20000,
        "credit_score": 758,
        "product_code": "SME_GROWTH",
        "amount": 2000000,
        "tenor": 36,
        "purpose": "Commercial warehouse inventory expansion",
        "status": ApplicationStatus.UNDER_REVIEW,
    },
    {
        "first_name": "Siddharth",
        "last_name": "Malhotra",
        "email": "siddharth.malhotra@gmail.com",
        "phone": "+919810890117",
        "pan": "QQPSM7817Q",
        "city": "Gurugram, Haryana",
        "address": "Penthouse 18, Golf Course Road DLF Phase 5",
        "employer": "McKinsey & Company",
        "title": "Associate Partner",
        "income": 350000,
        "existing_debt": 55000,
        "credit_score": 830,
        "product_code": "HOME_PRIME",
        "amount": 9500000,
        "tenor": 240,
        "purpose": "Apartment purchase in The Camellias",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Neha",
        "last_name": "Choudhury",
        "email": "neha.choudhury@gmail.com",
        "phone": "+919861901218",
        "pan": "RRRNC8918R",
        "city": "Bhubaneswar, Odisha",
        "address": "61 Janpath, Saheed Nagar",
        "employer": "NTPC Eastern Region",
        "title": "Deputy General Manager",
        "income": 165000,
        "existing_debt": 22000,
        "credit_score": 782,
        "product_code": "PERSONAL_FLEX",
        "amount": 750000,
        "tenor": 48,
        "purpose": "Rooftop solar and home battery installation",
        "status": ApplicationStatus.RISK_ASSESSED,
    },
    {
        "first_name": "Manoj",
        "last_name": "Tiwari",
        "email": "manoj.tiwari@gmail.com",
        "phone": "+919835012319",
        "pan": "SSPMT9019S",
        "city": "Patna, Bihar",
        "address": "14 Boring Road, Sri Krishna Puri",
        "employer": "Tiwari Diagnostic Imaging",
        "title": "Consultant Radiologist & MD",
        "income": 190000,
        "existing_debt": 32000,
        "credit_score": 768,
        "product_code": "SME_GROWTH",
        "amount": 3500000,
        "tenor": 60,
        "purpose": "High-resolution digital MRI scanner downpayment",
        "status": ApplicationStatus.DOCUMENTS_VERIFIED,
    },
    {
        "first_name": "Ritu",
        "last_name": "Menon",
        "email": "ritu.menon@gmail.com",
        "phone": "+919847123420",
        "pan": "TTPRM0120T",
        "city": "Thiruvananthapuram, Kerala",
        "address": "22 Kowdiar Avenue",
        "employer": "ISRO - Vikram Sarabhai Space Centre",
        "title": "Scientist / Engineer - SG",
        "income": 150000,
        "existing_debt": 18000,
        "credit_score": 795,
        "product_code": "HOME_PRIME",
        "amount": 3600000,
        "tenor": 144,
        "purpose": "Ancestral home heritage restoration",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Alok",
        "last_name": "Gupta",
        "email": "alok.gupta@gmail.com",
        "phone": "+919818234521",
        "pan": "UUPAG1221U",
        "city": "Noida, Uttar Pradesh",
        "address": "Tower 4, Sector 128 Express Highway",
        "employer": "Samsung R&D Institute",
        "title": "Chief Staff Architect",
        "income": 225000,
        "existing_debt": 34000,
        "credit_score": 790,
        "product_code": "HOME_PRIME",
        "amount": 5500000,
        "tenor": 180,
        "purpose": "Golf course facing apartment in Sector 150",
        "status": ApplicationStatus.DOCUMENTS_VERIFIED,
    },
    {
        "first_name": "Divya",
        "last_name": "Sundaram",
        "email": "divya.sundaram@gmail.com",
        "phone": "+919842345622",
        "pan": "VVPSD2322V",
        "city": "Coimbatore, Tamil Nadu",
        "address": "90 Race Course Road",
        "employer": "Lakshmi Machine Works",
        "title": "Senior Metallurgy Engineer",
        "income": 110000,
        "existing_debt": 12000,
        "credit_score": 748,
        "product_code": "PERSONAL_FLEX",
        "amount": 450000,
        "tenor": 36,
        "purpose": "Solar micro-grid setup for residence",
        "status": ApplicationStatus.SUBMITTED,
    },
    {
        "first_name": "Gaurav",
        "last_name": "Bhatia",
        "email": "gaurav.bhatia@gmail.com",
        "phone": "+919815456723",
        "pan": "WWPGB3423W",
        "city": "Amritsar, Punjab",
        "address": "18 Mall Road, Civil Lines",
        "employer": "Golden Temple Hospitality Group",
        "title": "General Manager",
        "income": 135000,
        "existing_debt": 22000,
        "credit_score": 730,
        "product_code": "SME_GROWTH",
        "amount": 1800000,
        "tenor": 36,
        "purpose": "Boutique hotel restaurant kitchen modernizing",
        "status": ApplicationStatus.UNDER_REVIEW,
    },
    {
        "first_name": "Swati",
        "last_name": "Mukhopadhyay",
        "email": "swati.mukherjee@gmail.com",
        "phone": "+919832567824",
        "pan": "XXPSM4524X",
        "city": "Durgapur, West Bengal",
        "address": "B-4 City Centre, Bidhan Nagar",
        "employer": "Steel Authority of India Ltd (SAIL)",
        "title": "Principal Metallurgical Consultant",
        "income": 140000,
        "existing_debt": 16000,
        "credit_score": 762,
        "product_code": "HOME_PRIME",
        "amount": 2800000,
        "tenor": 120,
        "purpose": "Duplex villa construction in Greenfield City",
        "status": ApplicationStatus.DISBURSED,
    },
    {
        "first_name": "Nikhil",
        "last_name": "Hegde",
        "email": "nikhil.hegde@gmail.com",
        "phone": "+919845678925",
        "pan": "YYPNH5625Y",
        "city": "Mangaluru, Karnataka",
        "address": "101 Kadri Hills",
        "employer": "Hegde Coastal Logistics",
        "title": "Fleet Operations Director",
        "income": 170000,
        "existing_debt": 26000,
        "credit_score": 775,
        "product_code": "SME_GROWTH",
        "amount": 2800000,
        "tenor": 48,
        "purpose": "Refrigerated inter-city seafood transport trucks",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Shalini",
        "last_name": "Saxena",
        "email": "shalini.saxena@gmail.com",
        "phone": "+919827789026",
        "pan": "ZZPSS6726Z",
        "city": "Bhopal, Madhya Pradesh",
        "address": "4 Arera Colony, E-3",
        "employer": "Bharat Heavy Electricals Ltd (BHEL)",
        "title": "Senior Design Engineer",
        "income": 125000,
        "existing_debt": 15000,
        "credit_score": 755,
        "product_code": "PERSONAL_FLEX",
        "amount": 550000,
        "tenor": 36,
        "purpose": "Daughter's professional aerospace engineering tuition",
        "status": ApplicationStatus.RISK_ASSESSED,
    },
    {
        "first_name": "Varun",
        "last_name": "Nambiar",
        "email": "varun.nambiar@gmail.com",
        "phone": "+919847890127",
        "pan": "AAPVN7827A",
        "city": "Kozhikode, Kerala",
        "address": "52 Wayanad Road, East Hill",
        "employer": "Malabar Tech Solutions",
        "title": "Co-founder & CTO",
        "income": 190000,
        "existing_debt": 25000,
        "credit_score": 785,
        "product_code": "SME_GROWTH",
        "amount": 3200000,
        "tenor": 48,
        "purpose": "AI Cloud infrastructure cluster expansion",
        "status": ApplicationStatus.DOCUMENTS_VERIFIED,
    },
    {
        "first_name": "Shreya",
        "last_name": "Singhal",
        "email": "shreya.singhal@gmail.com",
        "phone": "+919837901228",
        "pan": "BBPSC8928B",
        "city": "Dehradun, Uttarakhand",
        "address": "19 Rajpur Road",
        "employer": "Singhal & Co Chambers",
        "title": "Senior Advocate",
        "income": 210000,
        "existing_debt": 30000,
        "credit_score": 798,
        "product_code": "HOME_PRIME",
        "amount": 5200000,
        "tenor": 180,
        "purpose": "Hillside cottage and legal chamber establishment",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Abhinav",
        "last_name": "Pandey",
        "email": "abhinav.pandey@gmail.com",
        "phone": "+919838012329",
        "pan": "CCPAP9029C",
        "city": "Varanasi, Uttar Pradesh",
        "address": "88 Sigra Road, Mahmoorganj",
        "employer": "Banaras Silk Weavers Guild",
        "title": "General Secretary & Exporter",
        "income": 145000,
        "existing_debt": 20000,
        "credit_score": 742,
        "product_code": "SME_GROWTH",
        "amount": 2200000,
        "tenor": 36,
        "purpose": "Handloom modernization and international export inventory",
        "status": ApplicationStatus.UNDER_REVIEW,
    },
    {
        "first_name": "Nandini",
        "last_name": "Das",
        "email": "nandini.das@gmail.com",
        "phone": "+919864123430",
        "pan": "DDPND0130D",
        "city": "Guwahati, Assam",
        "address": "15 GS Road, Christian Basti",
        "employer": "Oil India Ltd",
        "title": "Senior Petroleum Geologist",
        "income": 170000,
        "existing_debt": 22000,
        "credit_score": 780,
        "product_code": "HOME_PRIME",
        "amount": 4000000,
        "tenor": 144,
        "purpose": "Brahmaputra view apartment purchase",
        "status": ApplicationStatus.DOCUMENTS_VERIFIED,
    },
    {
        "first_name": "Prateek",
        "last_name": "Bansal",
        "email": "prateek.bansal@gmail.com",
        "phone": "+919812234531",
        "pan": "EEPPB1231E",
        "city": "Faridabad, Haryana",
        "address": "Sector 15 Main Market Road",
        "employer": "Bansal Precision Fasteners",
        "title": "Managing Director",
        "income": 240000,
        "existing_debt": 40000,
        "credit_score": 765,
        "product_code": "SME_GROWTH",
        "amount": 4000000,
        "tenor": 48,
        "purpose": "Zinc electroplating line automation",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Tanvi",
        "last_name": "Trivedi",
        "email": "tanvi.trivedi@gmail.com",
        "phone": "+919824345632",
        "pan": "FFPTT2332F",
        "city": "Vadodara, Gujarat",
        "address": "72 Alkapuri, RC Dutt Road",
        "employer": "Larsen & Toubro Ltd",
        "title": "Senior Structural Engineer",
        "income": 135000,
        "existing_debt": 16000,
        "credit_score": 764,
        "product_code": "PERSONAL_FLEX",
        "amount": 450000,
        "tenor": 24,
        "purpose": "Home electrical grid solar retrofit",
        "status": ApplicationStatus.SUBMITTED,
    },
    {
        "first_name": "Sachin",
        "last_name": "Sawant",
        "email": "sachin.sawant@gmail.com",
        "phone": "+919823456733",
        "pan": "GGPSZ3433G",
        "city": "Nashik, Maharashtra",
        "address": "44 Gangapur Road",
        "employer": "Sula Vineyards Ltd",
        "title": "Viticulture Operations Manager",
        "income": 115000,
        "existing_debt": 14000,
        "credit_score": 750,
        "product_code": "PERSONAL_FLEX",
        "amount": 350000,
        "tenor": 36,
        "purpose": "Micro-drip irrigation equipment installation",
        "status": ApplicationStatus.UNDER_REVIEW,
    },
    {
        "first_name": "Rashmi",
        "last_name": "Balakrishnan",
        "email": "rashmi.bala@gmail.com",
        "phone": "+919886567834",
        "pan": "HHPRA4534H",
        "city": "Mysuru, Karnataka",
        "address": "12 Gokulam 3rd Stage",
        "employer": "CFTRI Research Staff",
        "title": "Principal Food Scientist",
        "income": 140000,
        "existing_debt": 18000,
        "credit_score": 774,
        "product_code": "HOME_PRIME",
        "amount": 3400000,
        "tenor": 144,
        "purpose": "Eco-friendly sustainable brick home near Chamundi Foothills",
        "status": ApplicationStatus.DISBURSED,
    },
    {
        "first_name": "Tarun",
        "last_name": "Goswami",
        "email": "tarun.goswami@gmail.com",
        "phone": "+919835678935",
        "pan": "IIPTG5635I",
        "city": "Ranchi, Jharkhand",
        "address": "29 Kanke Road",
        "employer": "Central Coalfields Ltd (CCL)",
        "title": "Deputy Chief Mining Engineer",
        "income": 150000,
        "existing_debt": 24000,
        "credit_score": 738,
        "product_code": "PERSONAL_FLEX",
        "amount": 650000,
        "tenor": 48,
        "purpose": "Son's medical college hostel & tuition fees",
        "status": ApplicationStatus.DOCUMENTS_PENDING,
    },
    {
        "first_name": "Pallavi",
        "last_name": "Shinde",
        "email": "pallavi.shinde@gmail.com",
        "phone": "+919822789036",
        "pan": "JJFPS6736J",
        "city": "Nagpur, Maharashtra",
        "address": "9 Civil Lines, Palm Road",
        "employer": "Persistent Systems Nagpur",
        "title": "Scrum Master & QA Manager",
        "income": 120000,
        "existing_debt": 15000,
        "credit_score": 760,
        "product_code": "HOME_PRIME",
        "amount": 2900000,
        "tenor": 120,
        "purpose": "Row house purchase near MIHAN SEZ",
        "status": ApplicationStatus.RISK_ASSESSED,
    },
    {
        "first_name": "Vishal",
        "last_name": "Khatri",
        "email": "vishal.khatri@gmail.com",
        "phone": "+919825890137",
        "pan": "KKPVK7837K",
        "city": "Surat, Gujarat",
        "address": "501 Ring Road Diamond Market",
        "employer": "Khatri Gems Export",
        "title": "Partner",
        "income": 310000,
        "existing_debt": 48000,
        "credit_score": 815,
        "product_code": "SME_GROWTH",
        "amount": 5000000,
        "tenor": 60,
        "purpose": "Laser diamond cutting & polishing workstation installation",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Ishita",
        "last_name": "Ganguly",
        "email": "ishita.ganguly@gmail.com",
        "phone": "+919830901238",
        "pan": "LLPIG8938L",
        "city": "Asansol, West Bengal",
        "address": "7 Burnpur Road",
        "employer": "Eastern Railway Divisional Hospital",
        "title": "Senior Anaesthesiologist",
        "income": 160000,
        "existing_debt": 22000,
        "credit_score": 782,
        "product_code": "PERSONAL_FLEX",
        "amount": 700000,
        "tenor": 36,
        "purpose": "Solar power installation for clinic and residence",
        "status": ApplicationStatus.DOCUMENTS_VERIFIED,
    },
    {
        "first_name": "Chetan",
        "last_name": "Solanki",
        "email": "chetan.solanki@gmail.com",
        "phone": "+919824012339",
        "pan": "MMPCS9039M",
        "city": "Rajkot, Gujarat",
        "address": "8 Yagnik Road",
        "employer": "Solanki Foundry & Pumps",
        "title": "Managing Director",
        "income": 230000,
        "existing_debt": 38000,
        "credit_score": 758,
        "product_code": "SME_GROWTH",
        "amount": 3500000,
        "tenor": 48,
        "purpose": "Submersible pump motor automated winding unit",
        "status": ApplicationStatus.SUBMITTED,
    },
    {
        "first_name": "Bhavna",
        "last_name": "Venkatesh",
        "email": "bhavna.venkatesh@gmail.com",
        "phone": "+919842123440",
        "pan": "NNPBV0140N",
        "city": "Madurai, Tamil Nadu",
        "address": "33 West Veli Street",
        "employer": "Aravind Eye Care System",
        "title": "Senior Refractive Surgeon",
        "income": 185000,
        "existing_debt": 24000,
        "credit_score": 802,
        "product_code": "HOME_PRIME",
        "amount": 4800000,
        "tenor": 180,
        "purpose": "Gated community luxury residence in KK Nagar",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Kunal",
        "last_name": "Bhardwaj",
        "email": "kunal.bhardwaj@gmail.com",
        "phone": "+919839234541",
        "pan": "OOPKB1241O",
        "city": "Kanpur, Uttar Pradesh",
        "address": "12 Civil Lines, Mall Road",
        "employer": "Bhardwaj Leather Exporters",
        "title": "Operations Lead",
        "income": 160000,
        "existing_debt": 28000,
        "credit_score": 685,
        "product_code": "SME_GROWTH",
        "amount": 3000000,
        "tenor": 36,
        "purpose": "Effluent treatment plant modernization compliant with CPCB",
        "status": ApplicationStatus.REJECTED,
    },
    {
        "first_name": "Aparna",
        "last_name": "Shenoy",
        "email": "aparna.shenoy@gmail.com",
        "phone": "+919845345642",
        "pan": "PPQAS2342P",
        "city": "Udupi, Karnataka",
        "address": "18 Manipal High Road",
        "employer": "Kasturba Medical College",
        "title": "Associate Professor of Pathology",
        "income": 135000,
        "existing_debt": 16000,
        "credit_score": 776,
        "product_code": "HOME_PRIME",
        "amount": 3500000,
        "tenor": 144,
        "purpose": "Hillside home in Manipal with coastal breeze design",
        "status": ApplicationStatus.DOCUMENTS_VERIFIED,
    },
    {
        "first_name": "Mohit",
        "last_name": "Jindal",
        "email": "mohit.jindal@gmail.com",
        "phone": "+919814456743",
        "pan": "QQPMJ3443Q",
        "city": "Ludhiana, Punjab",
        "address": "90 Ferozepur Road",
        "employer": "Jindal Woolen Mills",
        "title": "Partner",
        "income": 270000,
        "existing_debt": 42000,
        "credit_score": 790,
        "product_code": "SME_GROWTH",
        "amount": 4200000,
        "tenor": 48,
        "purpose": "High-speed Italian Jacquard circular knitting looms",
        "status": ApplicationStatus.DISBURSED,
    },
    {
        "first_name": "Lavanya",
        "last_name": "Krishnan",
        "email": "lavanya.krishnan@gmail.com",
        "phone": "+919843567844",
        "pan": "RRRLK4544R",
        "city": "Tiruchirappalli, Tamil Nadu",
        "address": "45 Salai Road, Thillai Nagar",
        "employer": "National Institute of Technology (NIT Trichy)",
        "title": "Professor of Electrical Engineering",
        "income": 155000,
        "existing_debt": 18000,
        "credit_score": 808,
        "product_code": "HOME_PRIME",
        "amount": 3900000,
        "tenor": 144,
        "purpose": "Solar powered independent house construction",
        "status": ApplicationStatus.APPROVED,
    },
    {
        "first_name": "Devendra",
        "last_name": "Chauhan",
        "email": "devendra.chauhan@gmail.com",
        "phone": "+919837678945",
        "pan": "SSSDC5645S",
        "city": "Agra, Uttar Pradesh",
        "address": "16 Fatehabad Road, Tajganj",
        "employer": "Chauhan Inox Fabrication",
        "title": "Proprietor",
        "income": 110000,
        "existing_debt": 36000,
        "credit_score": 630,
        "product_code": "PERSONAL_FLEX",
        "amount": 800000,
        "tenor": 24,
        "purpose": "Urgent debt consolidation and cash buffer",
        "status": ApplicationStatus.REJECTED,
    },
]


async def seed_indian_borrowers_data(session: Optional[AsyncSession] = None) -> None:
    """Populates 45 diverse Indian applicants with comprehensive applications and artifacts."""

    async def _populate(s: AsyncSession) -> None:
        logger.info("Checking institutional products and officers...")
        # Get or create Loan Officer
        officer_res = await s.execute(
            select(User).where(User.role == UserRole.LOAN_OFFICER).limit(1)
        )
        officer = officer_res.scalar_one_or_none()
        if not officer:
            officer = User(
                id=uuid.uuid4(),
                email="officer@credvidhi.in",
                password_hash=get_password_hash("Officer@CredVidhi2026"),
                first_name="Arjun",
                last_name="Mehta",
                role=UserRole.LOAN_OFFICER,
                is_active=True,
                phone_number="+919876543211",
                pan_number="BCDEF2345G",
            )
            s.add(officer)
            await s.flush()

        # Get or create Risk Analyst
        analyst_res = await s.execute(
            select(User).where(User.role == UserRole.RISK_ANALYST).limit(1)
        )
        analyst = analyst_res.scalar_one_or_none()
        if not analyst:
            analyst = User(
                id=uuid.uuid4(),
                email="underwriter@credvidhi.in",
                password_hash=get_password_hash("Underwriter@CredVidhi2026"),
                first_name="Priya",
                last_name="Sharma",
                role=UserRole.RISK_ANALYST,
                is_active=True,
                phone_number="+919876543212",
                pan_number="CDEFG3456H",
            )
            s.add(analyst)
            await s.flush()

        # Ensure core products exist
        products_map: Dict[str, LoanProduct] = {}
        fallback_rates = {
            "HOME_PRIME": Decimal("8.50"),
            "SME_GROWTH": Decimal("11.25"),
            "PERSONAL_FLEX": Decimal("12.75"),
        }
        for code in ["HOME_PRIME", "SME_GROWTH", "PERSONAL_FLEX"]:
            prod_res = await s.execute(select(LoanProduct).where(LoanProduct.code == code))
            p = prod_res.scalar_one_or_none()
            if not p:
                p = LoanProduct(
                    id=uuid.uuid4(),
                    code=code,
                    name=code.replace("_", " ").title(),
                    description=f"CredVidhi standard product: {code}",
                    min_amount=Decimal("50000"),
                    max_amount=Decimal("50000000"),
                    min_tenor_months=6,
                    max_tenor_months=240,
                    base_apr=fallback_rates.get(code, Decimal("9.50")),
                    max_dti_ratio=Decimal("50.00"),
                    required_documents=[
                        "PAN_CARD",
                        "AADHAAR_CARD",
                        "SALARY_SLIP",
                        "BANK_STATEMENT",
                    ],
                    is_active=True,
                )
                s.add(p)
                await s.flush()
            products_map[code] = p

        # Fast idempotency check: if all applications already seeded, skip
        app_count_res = await s.execute(select(func.count(LoanApplication.id)))
        app_count = app_count_res.scalar_one()
        if app_count >= len(INDIAN_BORROWERS):
            logger.info(
                f"All {app_count} Indian borrower benchmark applications already present. Skipping."
            )
            return

        logger.info(
            f"Seeding {len(INDIAN_BORROWERS)} diverse Indian applicants and applications..."
        )
        seeded_count = 0
        default_borrower_hash = get_password_hash("Borrower@CredVidhi2026")

        for idx, b in enumerate(INDIAN_BORROWERS, 1):
            ref_num = f"APP-2026-{idx:04d}"
            # Check if user already exists
            user_res = await s.execute(select(User).where(User.email == b["email"]))
            user = user_res.scalar_one_or_none()
            if not user:
                user = User(
                    id=uuid.uuid4(),
                    email=b["email"],
                    password_hash=default_borrower_hash,
                    first_name=b["first_name"],
                    last_name=b["last_name"],
                    role=UserRole.APPLICANT,
                    is_active=True,
                    phone_number=b["phone"],
                    pan_number=b["pan"],
                )
                s.add(user)
                await s.flush()

            # Check if application exists
            app_res = await s.execute(
                select(LoanApplication).where(LoanApplication.reference_number == ref_num)
            )
            app = app_res.scalar_one_or_none()
            if not app:
                product = products_map.get(b["product_code"], list(products_map.values())[0])
                app = LoanApplication(
                    id=uuid.uuid4(),
                    reference_number=ref_num,
                    applicant_id=user.id,
                    product_id=product.id,
                    assigned_officer_id=officer.id,
                    status=b["status"],
                    requested_amount=Decimal(str(b["amount"])),
                    requested_tenor_months=b["tenor"],
                    purpose=b["purpose"],
                    applicant_personal_snapshot={
                        "full_name": f"{b['first_name']} {b['last_name']}",
                        "email": b["email"],
                        "phone": b["phone"],
                        "masked_pan": f"******{b['pan'][-4:]}",
                        "city": b["city"],
                        "residential_address": b["address"],
                    },
                    applicant_financial_snapshot={
                        "employer_name": b["employer"],
                        "job_title": b["title"],
                        "gross_monthly_income": b["income"],
                        "existing_monthly_debt": b["existing_debt"],
                        "declared_cibil_score": b["credit_score"],
                    },
                    submitted_at=datetime.now(timezone.utc),
                )
                s.add(app)
                await s.flush()

                # Add Documents for all applications beyond DRAFT
                doc_types = [
                    (DocumentType.PAN_CARD, f"PAN_{b['first_name']}.pdf", "application/pdf"),
                    (
                        DocumentType.AADHAAR_CARD,
                        f"Aadhaar_{b['first_name']}.pdf",
                        "application/pdf",
                    ),
                    (
                        DocumentType.SALARY_SLIP,
                        f"SalarySlip_{b['first_name']}.pdf",
                        "application/pdf",
                    ),
                    (
                        DocumentType.BANK_STATEMENT,
                        f"BankStatement_90d_{b['first_name']}.pdf",
                        "application/pdf",
                    ),
                ]
                doc_status = (
                    DocumentVerificationStatus.VERIFIED
                    if b["status"]
                    in [
                        ApplicationStatus.DOCUMENTS_VERIFIED,
                        ApplicationStatus.RISK_ASSESSED,
                        ApplicationStatus.APPROVED,
                        ApplicationStatus.DISBURSED,
                        ApplicationStatus.REJECTED,
                    ]
                    else DocumentVerificationStatus.PENDING
                )

                for doc_type, filename, mime in doc_types:
                    doc = ApplicationDocument(
                        id=uuid.uuid4(),
                        application_id=app.id,
                        document_type=doc_type,
                        original_filename=filename,
                        storage_path=f"documents/{app.id}/{uuid.uuid4().hex[:8]}_{filename}",
                        mime_type=mime,
                        file_size_bytes=1024 * 350,
                        verification_status=doc_status,
                        verification_remarks=f"Verified against NSDL/UIDAI/Bank e-verify by Officer {officer.first_name}"
                        if doc_status == DocumentVerificationStatus.VERIFIED
                        else None,
                        verified_by=officer.id
                        if doc_status == DocumentVerificationStatus.VERIFIED
                        else None,
                        verified_at=datetime.now(timezone.utc)
                        if doc_status == DocumentVerificationStatus.VERIFIED
                        else None,
                    )
                    s.add(doc)

                # Add Risk Assessment if stage is RISK_ASSESSED or later
                if b["status"] in [
                    ApplicationStatus.RISK_ASSESSED,
                    ApplicationStatus.APPROVED,
                    ApplicationStatus.DISBURSED,
                    ApplicationStatus.REJECTED,
                ]:
                    # Deterministic monthly payment calculation using centralized financial engine
                    n = b["tenor"]
                    p_amt = Decimal(str(b["amount"]))
                    income_dec = Decimal(str(b["income"]))
                    debt_dec = Decimal(str(b["existing_debt"]))
                    housing_dec = Decimal(str(b.get("housing_expense", 25000)))

                    emi_rounded = calculate_emi(p_amt, product.base_apr, n)
                    dti = calculate_dti(income_dec, debt_dec, emi_rounded)
                    disposable = calculate_disposable_income(
                        income_dec, debt_dec, housing_dec, emi_rounded
                    )

                    tier = (
                        RiskTier.LOW
                        if b["credit_score"] >= 750 and dti <= 40
                        else (
                            RiskTier.MEDIUM
                            if b["credit_score"] >= 700 and dti <= 50
                            else RiskTier.HIGH
                        )
                    )
                    rec = (
                        UnderwritingRecommendation.APPROVE
                        if tier == RiskTier.LOW
                        else (
                            UnderwritingRecommendation.CONDITIONAL
                            if tier == RiskTier.MEDIUM
                            else UnderwritingRecommendation.REJECT
                        )
                    )

                    risk = RiskAssessment(
                        id=uuid.uuid4(),
                        application_id=app.id,
                        calculated_dti=dti,
                        calculated_emi=emi_rounded,
                        disposable_income=disposable,
                        internal_risk_score=b["credit_score"],
                        risk_tier=tier,
                        recommendation=rec,
                        score_factors_breakdown={
                            "bureau_score": b["credit_score"],
                            "dti_ratio": float(dti),
                            "disposable_surplus": float(disposable),
                            "employment_stability": "VERIFIED_PERMANENT",
                        },
                        evaluated_at=datetime.now(timezone.utc),
                    )
                    s.add(risk)

                # Add Decision for APPROVED, DISBURSED, REJECTED
                if b["status"] in [
                    ApplicationStatus.APPROVED,
                    ApplicationStatus.DISBURSED,
                    ApplicationStatus.REJECTED,
                ]:
                    dec_type = (
                        DecisionType.REJECTED
                        if b["status"] == ApplicationStatus.REJECTED
                        else DecisionType.APPROVED
                    )
                    decision = LoanDecision(
                        id=uuid.uuid4(),
                        application_id=app.id,
                        underwriter_id=analyst.id,
                        decision=dec_type,
                        approved_amount=Decimal(str(b["amount"]))
                        if dec_type == DecisionType.APPROVED
                        else None,
                        approved_apr=product.base_apr
                        if dec_type == DecisionType.APPROVED
                        else None,
                        approved_tenor_months=b["tenor"]
                        if dec_type == DecisionType.APPROVED
                        else None,
                        rejection_reason_code="HIGH_DTI_RATIO"
                        if dec_type == DecisionType.REJECTED
                        else None,
                        underwriter_notes=f"Credit sanction approved based on spotless CIBIL {b['credit_score']} and strong debt-service coverage."
                        if dec_type == DecisionType.APPROVED
                        else "DTI exceeds institutional policy limit of 50%. Adverse action notice issued.",
                        decided_at=datetime.now(timezone.utc),
                    )
                    s.add(decision)

                audit = AuditLog(
                    id=uuid.uuid4(),
                    event_type="APPLICATION_SEEDED",
                    entity_name="loan_applications",
                    entity_id=app.id,
                    actor_id=officer.id,
                    actor_role=officer.role.value,
                    prior_state=None,
                    subsequent_state={"status": b["status"].value},
                    metadata_snapshot={
                        "notes": f"Seeded benchmark borrower '{b['first_name']} {b['last_name']}' in status {b['status'].value}"
                    },
                )
                s.add(audit)
                seeded_count += 1

        await s.commit()
        logger.info(
            f"Successfully seeded {seeded_count} Indian borrower applications into Postgres!"
        )

    if session is not None:
        await _populate(session)
    else:
        async with async_session_factory() as sess:
            await _populate(sess)


async def main() -> None:
    """Entry point with clean engine disposal to prevent connection leaks."""
    try:
        await seed_indian_borrowers_data()
    finally:
        from app.database import engine

        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
