"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding Bangladesh Land Platform authoritative data...');
    // Clean existing data
    await prisma.complaint.deleteMany();
    await prisma.discrepancy.deleteMany();
    await prisma.document.deleteMany();
    await prisma.timelineEvent.deleteMany();
    await prisma.taxRecord.deleteMany();
    await prisma.mutation.deleteMany();
    await prisma.parcel.deleteMany();
    // 1. Primary Parcel: Savar, Dhaka
    const parcel1 = await prisma.parcel.create({
        data: {
            id: 'BD-DHK-SAV-000001',
            division: 'Dhaka',
            district: 'Dhaka',
            upazila: 'Savar',
            mouza: 'Tetuljhora',
            jlNumber: 42,
            khatianNo: 'RS-4502 / BS-1890',
            dagNo: '1204 / 1205 (Part)',
            holdingNo: 'H-89/A (Ward 04)',
            landClass: 'Residential (বাস্তুভিটা)',
            areaDecimal: 5.5,
            currentOwner: 'Md. Rafiqul Islam (মোঃ রফিকুল ইসলাম)',
            nidNumber: '19852691234567890',
            phone: '+880 1711-223344',
            email: 'rafiqul.islam@example.com',
            geojsonBoundary: {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        [
                            [90.2581, 23.8432],
                            [90.2592, 23.8435],
                            [90.2595, 23.8427],
                            [90.2583, 23.8424],
                            [90.2581, 23.8432]
                        ]
                    ]
                },
                properties: {
                    dagNo: '1204',
                    areaDecimal: 5.5,
                    landClass: 'বাস্তুভিটা'
                }
            },
            mutations: {
                create: [
                    {
                        caseNumber: 'MUT-2026-DH-0941',
                        applicantName: 'Md. Rafiqul Islam',
                        applicantNid: '19852691234567890',
                        applicantPhone: '+880 1711-223344',
                        proposedOwner: 'Md. Rafiqul Islam',
                        status: client_1.MutationStatus.APPROVED,
                        currentStage: 'Stage 4: DCR Payment Verified & Final Khatiyan Issued',
                        hearingDate: new Date('2026-02-15'),
                        dcrAmount: 1150.0,
                        remarks: 'Kanungo physical verification and AC Land hearing completed without objections.'
                    },
                    {
                        caseNumber: 'MUT-2026-DH-1044',
                        applicantName: 'Kamal Hossain (Co-heir)',
                        applicantNid: '19902699876543210',
                        applicantPhone: '+880 1819-556677',
                        proposedOwner: 'Kamal Hossain',
                        status: client_1.MutationStatus.KANUNGO_VERIFICATION,
                        currentStage: 'Stage 2: Kanungo Field Survey & Report Pending',
                        hearingDate: new Date('2026-09-10'),
                        dcrAmount: 1150.0,
                        remarks: 'Under Kanungo spot survey.'
                    }
                ]
            },
            taxRecords: {
                create: [
                    {
                        fiscalYear: '1433-1434 (2026-2027)',
                        annualDemandBDT: 1350.0,
                        arrearAmountBDT: 0.0,
                        totalDueBDT: 1350.0,
                        paidAmountBDT: 0.0,
                        status: client_1.PaymentStatus.PENDING,
                        trxId: null,
                        paymentMethod: null,
                        dakhilaNumber: null,
                        qrCodeUrl: null
                    },
                    {
                        fiscalYear: '1432-1433 (2025-2026)',
                        annualDemandBDT: 1250.0,
                        arrearAmountBDT: 0.0,
                        totalDueBDT: 1250.0,
                        paidAmountBDT: 1250.0,
                        status: client_1.PaymentStatus.VERIFIED,
                        trxId: 'BKASH_9X81LA90',
                        paymentMethod: 'bKash Digital Gateway',
                        dakhilaNumber: 'DAK-2026-849102',
                        qrCodeUrl: 'https://land.gov.bd/verify/dakhila/DAK-2026-849102',
                        paymentDate: new Date('2026-04-14'),
                        reconciledAt: new Date('2026-04-14T10:15:00Z'),
                        reconciledBy: 'n8n-automated-recon-bot'
                    }
                ]
            },
            timelineEvents: {
                create: [
                    {
                        eventType: 'MUTATION_APPROVED',
                        title: 'e-Mutation Completed & Khatian Published',
                        description: 'AC Land Savar approved mutation case MUT-2026-DH-0941. Digital Khatian generated.',
                        actor: 'AC (Land), Savar Upazila',
                        referenceDoc: 'MUT-2026-DH-0941',
                        eventDate: new Date('2026-02-18')
                    },
                    {
                        eventType: 'TAX_PAID',
                        title: 'LD Tax Cleared with e-Dakhila',
                        description: 'bKash online payment of 1,250 BDT recorded with Dakhila DAK-2026-849102.',
                        actor: 'Citizen Gateway (Automated)',
                        referenceDoc: 'DAK-2026-849102',
                        eventDate: new Date('2026-04-14')
                    },
                    {
                        eventType: 'GIS_SURVEY',
                        title: 'Digital Cadastral Survey Sync',
                        description: 'DLRS automated GPS boundary vector synchronized with PostGIS spatial layer.',
                        actor: 'DLRS Geospatial Drone Survey',
                        referenceDoc: 'CAD-SVR-42-1204',
                        eventDate: new Date('2026-06-01')
                    }
                ]
            },
            discrepancies: {
                create: [
                    {
                        mismatchType: 'Spatial Boundary vs RS Mouza Sheet',
                        sourceA: 'RS Mouza Map Sheet #04 (1988 Manual Cadastre)',
                        sourceB: 'DLRS 2026 Drone GIS Vector Cadastre',
                        severity: 'LOW',
                        isResolved: false,
                        flaggedBy: 'n8n-land-recon-engine'
                    }
                ]
            },
            complaints: {
                create: [
                    {
                        trackingNo: 'CMP-SAV-2026-0041',
                        complainant: 'Abdul Karim (Neighbor)',
                        phone: '+880 1819-001122',
                        category: 'Plot Boundary Demarcation (সীমানা নির্ধারণ)',
                        description: 'Request for joint physical survey for North-Western ridge boundary demarcation.',
                        assignedOffice: 'Tetuljhora Union Land Office, Savar',
                        status: 'ROUTED',
                        createdAt: new Date('2026-07-10')
                    }
                ]
            },
            documents: {
                create: [
                    {
                        docType: 'KHATIAN_PARCHA',
                        fileName: 'khatian_bs_1890.pdf',
                        fileUrl: 'https://land.gov.bd/parcha/bs-1890-dhk.pdf',
                        ocrText: 'খতিয়ান নং ১৮৯০ • মৌজা তেঁতুলঝোড়া • দাগ ১২০৪ • স্বত্বাধিকারী মোঃ রফিকুল ইসলাম'
                    },
                    {
                        docType: 'SALE_DEED',
                        fileName: 'deed_4412_2021.pdf',
                        fileUrl: 'https://land.gov.bd/deeds/deed-4412-2021.pdf',
                        ocrText: 'সাব-রেজিস্ট্রি দলিল ৪৪১২/২০২১ • সাভার সাব-রেজিস্ট্রি অফিস'
                    },
                    {
                        docType: 'DAKHILA_RECEIPT',
                        fileName: 'dakhila_2026_849102.pdf',
                        fileUrl: 'https://land.gov.bd/dakhila/DAK-2026-849102.pdf',
                        ocrText: 'ভূমি উন্নয়ন কর দাখিলা • দাখিলা নং DAK-2026-849102 • পরিশোধিত ১২৫০ টাকা'
                    }
                ]
            }
        }
    });
    // 2. Secondary Parcel: Panchlaish, Chittagong
    await prisma.parcel.create({
        data: {
            id: 'BD-CTG-PAN-000492',
            division: 'Chattogram',
            district: 'Chattogram',
            upazila: 'Panchlaish',
            mouza: 'Nasirabad',
            jlNumber: 15,
            khatianNo: 'BS-9021',
            dagNo: '450',
            holdingNo: 'P-12/3',
            landClass: 'Commercial (বাণিজ্যিক)',
            areaDecimal: 12.0,
            currentOwner: 'Begum Sufia Rahman (বেগম সুফিয়া রহমান)',
            nidNumber: '19761598765432101',
            phone: '+880 1812-334455',
            email: 'sufia.rahman@example.com',
            geojsonBoundary: {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        [
                            [91.8211, 22.3654],
                            [91.8224, 22.3658],
                            [91.8229, 22.3649],
                            [91.8215, 22.3646],
                            [91.8211, 22.3654]
                        ]
                    ]
                },
                properties: {
                    dagNo: '450',
                    areaDecimal: 12.0,
                    landClass: 'বাণিজ্যিক'
                }
            },
            taxRecords: {
                create: [
                    {
                        fiscalYear: '1433-1434 (2026-2027)',
                        annualDemandBDT: 4800.0,
                        arrearAmountBDT: 0.0,
                        totalDueBDT: 4800.0,
                        paidAmountBDT: 4800.0,
                        status: client_1.PaymentStatus.VERIFIED,
                        trxId: 'EKPAY_77A82910',
                        paymentMethod: 'Ekpay Gateway',
                        dakhilaNumber: 'DAK-2026-993812',
                        qrCodeUrl: 'https://land.gov.bd/verify/dakhila/DAK-2026-993812',
                        paymentDate: new Date('2026-05-10')
                    }
                ]
            }
        }
    });
    console.log(`✅ Seed completed successfully! Seeded parcels: ${parcel1.id}, BD-CTG-PAN-000492`);
}
main()
    .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
