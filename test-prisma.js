const fs = require('fs');
require('dotenv/config');

try {
    const { PrismaClient } = require('@prisma/client');
    console.log('PrismaClient imported successfully');

    const prisma = new PrismaClient();
    console.log('PrismaClient instantiated successfully');

    process.exit(0);
} catch (error) {
    const errorDetails = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...error
    };

    fs.writeFileSync('prisma-error.json', JSON.stringify(errorDetails, null, 2));
    console.error('Error details written to prisma-error.json');
    console.error('Error message:', error.message);
    process.exit(1);
}
