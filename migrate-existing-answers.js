// migrate-existing-answers.js
// Run this once to populate sessionId for existing Answer records
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateExistingAnswers() {
    console.log('Starting migration of existing Answer records...\n');

    try {
        // Find all answers without sessionId
        const answersWithoutSession = await prisma.answer.findMany({
            where: {
                sessionId: null
            },
            include: {
                question: {
                    include: {
                        session: true
                    }
                }
            }
        });

        console.log(`Found ${answersWithoutSession.length} answers without sessionId`);

        if (answersWithoutSession.length === 0) {
            console.log('✓ All answers already have sessionId. Nothing to migrate.');
            return;
        }

        let updated = 0;
        let failed = 0;

        for (const answer of answersWithoutSession) {
            try {
                if (answer.question && answer.question.session) {
                    await prisma.answer.update({
                        where: { id: answer.id },
                        data: {
                            sessionId: answer.question.sessionId
                        }
                    });
                    updated++;

                    if (updated % 10 === 0) {
                        console.log(`  Progress: ${updated}/${answersWithoutSession.length} answers migrated...`);
                    }
                } else {
                    console.warn(`  Warning: Answer ${answer.id} has no valid question/session. Skipping.`);
                    failed++;
                }
            } catch (error) {
                console.error(`  Error updating answer ${answer.id}:`, error.message);
                failed++;
            }
        }

        console.log(`\n✓ Migration complete!`);
        console.log(`  - Updated: ${updated} answers`);
        if (failed > 0) {
            console.log(`  - Failed/Skipped: ${failed} answers`);
        }

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration
migrateExistingAnswers()
    .then(() => {
        console.log('\n✅ Data migration completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Data migration failed:', error);
        process.exit(1);
    });
