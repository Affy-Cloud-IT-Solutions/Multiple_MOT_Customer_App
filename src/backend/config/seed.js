const User = require('../models/User');
const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const Reminder = require('../models/Reminder');
const Alert = require('../models/Alert');
const Audit = require('../models/Audit');
const Template = require('../models/Template');

async function seedDatabase() {
    try {
        // Check if admin already exists to prevent re-seeding if we don't want it,
        // but for safety in dev we can check if any user exists.
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('🌱 Database already seeded. Skipping initialization.');
            // Ensure admin@gmail.com exists
            const superAdmin = await User.findOne({ email: 'admin@gmail.com' });
            if (!superAdmin) {
                console.log('🔧 Admin admin@gmail.com missing. Creating admin user...');
                await User.create({
                    username: 'admin',
                    email: 'admin@gmail.com',
                    password: '123456',
                    role: 'admin'
                });
                console.log('✅ Super Admin user created.');
            } else {
                superAdmin.password = '123456';
                await superAdmin.save();
                console.log('✅ Super Admin password updated to 123456.');
            }

            // Ensure zaidjr107@gmail.com exists
            const zaidAdmin = await User.findOne({ email: 'zaidjr107@gmail.com' });
            if (!zaidAdmin) {
                console.log('🔧 Admin zaidjr107@gmail.com missing. Creating admin user...');
                await User.create({
                    username: 'zaidjr107',
                    email: 'zaidjr107@gmail.com',
                    password: '123456',
                    role: 'staff'
                });
                console.log('✅ Admin user created.');
            } else {
                zaidAdmin.password = '123456';
                zaidAdmin.role = 'staff';
                await zaidAdmin.save();
                console.log('✅ Admin password updated to 123456 and role to staff.');
            }

            // Ensure zaidjrjr107@gmail.com exists
            const zaidjrjrAdmin = await User.findOne({ email: 'zaidjrjr107@gmail.com' });
            if (!zaidjrjrAdmin) {
                console.log('🔧 Admin zaidjrjr107@gmail.com missing. Creating admin user...');
                await User.create({
                    username: 'zaidjrjr107',
                    email: 'zaidjrjr107@gmail.com',
                    password: '123456',
                    role: 'staff'
                });
                console.log('✅ Admin zaidjrjr107 user created.');
            } else {
                zaidjrjrAdmin.password = '123456';
                zaidjrjrAdmin.role = 'staff';
                await zaidjrjrAdmin.save();
                console.log('✅ Admin zaidjrjr107 password updated to 123456 and role to staff.');
            }
            return;
        }

        console.log('🧹 Clearing existing collections...');
        await Promise.all([
            User.deleteMany({}),
            Customer.deleteMany({}),
            Vehicle.deleteMany({}),
            Reminder.deleteMany({}),
            Alert.deleteMany({}),
            Audit.deleteMany({}),
            Template.deleteMany({})
        ]);

        console.log('👥 Seeding Customers...');
        const customerDocs = await Customer.create([
            {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                mobile: '07700 900077',
                preferredContact: 'SMS',
                address: '123 High Street, London'
            },
            {
                firstName: 'Sarah',
                lastName: 'Jenkins',
                email: 'sarah.j@example.com',
                mobile: '07700 900144',
                preferredContact: 'Email',
                address: '45 Station Road, Manchester'
            },
            {
                firstName: 'David',
                lastName: 'Smith',
                email: 'david.smith@example.com',
                mobile: '07700 900255',
                preferredContact: 'WhatsApp',
                address: '88 Park Lane, Birmingham'
            }
        ]);

        console.log('👤 Seeding Users (with role mapping)...');
        // Admin
        await User.create([
            {
                username: 'admin',
                email: 'admin@gmail.com',
                password: '123456',
                role: 'admin'
            },
            {
                username: 'zaidjr107',
                email: 'zaidjr107@gmail.com',
                password: '123456',
                role: 'staff'
            },
            {
                username: 'zaidjrjr107',
                email: 'zaidjrjr107@gmail.com',
                password: '123456',
                role: 'staff'
            }
        ]);

        // Customers mapped to Users
        const usersToCreate = [
            {
                username: 'john.doe',
                email: 'john.doe@example.com',
                password: 'john123',
                role: 'customer',
                customerId: customerDocs[0]._id
            },
            {
                username: 'sarah.j',
                email: 'sarah.j@example.com',
                password: 'sarah123',
                role: 'customer',
                customerId: customerDocs[1]._id
            },
            {
                username: 'david.smith',
                email: 'david.smith@example.com',
                password: 'david123',
                role: 'customer',
                customerId: customerDocs[2]._id
            }
        ];
        await User.create(usersToCreate);

        console.log('🚗 Seeding Vehicles...');
        const vehicleDocs = await Vehicle.create([
            {
                customerId: customerDocs[0]._id,
                registrationNumber: 'AB18 CDE',
                make: 'FORD',
                model: 'FOCUS TDCI',
                year: 2018,
                motExpiryDate: new Date('2026-08-25'),
                lastServiceDate: new Date('2025-08-20'),
                status: 'Active'
            },
            {
                customerId: customerDocs[1]._id,
                registrationNumber: 'LD65 XYZ',
                make: 'VAUXHALL',
                model: 'CORSA ECOFLEX',
                year: 2015,
                motExpiryDate: new Date('2026-07-29'),
                lastServiceDate: new Date('2025-07-15'),
                status: 'Active'
            },
            {
                customerId: customerDocs[2]._id,
                registrationNumber: 'MH07 KKK',
                make: 'BMW',
                model: '320D M SPORT',
                year: 2019,
                motExpiryDate: new Date('2026-08-10'),
                lastServiceDate: new Date('2025-10-05'),
                status: 'Active'
            }
        ]);

        console.log('🔔 Seeding Alerts...');
        await Alert.create([
            {
                type: 'SOLD',
                customerName: 'Sarah Jenkins',
                customerId: customerDocs[1]._id,
                registrationNumber: 'GY19 PLK',
                makeModel: 'AUDI A3',
                date: new Date('2026-07-22T09:30:00Z'),
                status: 'Pending'
            }
        ]);

        console.log('📝 Seeding Templates...');
        await Template.create({
            t45: "Dear [Name], Your [Vehicle] ([Reg]) MOT expires on [Expiry]. Book your MOT today.",
            t30: "Dear [Name], Just a reminder that your [Vehicle] ([Reg]) MOT is due in 30 days ([Expiry]). Book now.",
            t7: "URGENT: Dear [Name], Your [Vehicle] ([Reg]) MOT expires in 7 days on [Expiry]. Book immediately to avoid fines."
        });

        console.log('📊 Seeding Audits...');
        await Audit.create([
            {
                date: new Date('2026-07-20T09:00:00Z'),
                activity: 'Reminder Sent (45 Days)',
                details: 'Reminder 1 sent to John Doe for FORD FOCUS (AB18 CDE) via SMS'
            },
            {
                date: new Date('2026-07-21T09:00:00Z'),
                activity: 'Reminder Sent (7 Days)',
                details: 'Reminder 3 sent to Sarah Jenkins for VAUXHALL CORSA (LD65 XYZ) via Email'
            }
        ]);

        console.log('⏰ Seeding Reminders...');
        await Reminder.create([
            {
                vehicleId: vehicleDocs[0]._id,
                reminderType: '45_Days',
                reminderDate: new Date('2026-07-11'),
                sentStatus: true,
                sentTimestamp: new Date('2026-07-11T09:00:00Z'),
                communicationMethod: 'SMS'
            },
            {
                vehicleId: vehicleDocs[1]._id,
                reminderType: '30_Days',
                reminderDate: new Date('2026-06-29'),
                sentStatus: true,
                sentTimestamp: new Date('2026-06-29T09:00:00Z'),
                communicationMethod: 'Email'
            }
        ]);

        console.log('🎉 Database seeding completed successfully!');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
    }
}

module.exports = seedDatabase;
