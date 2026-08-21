import { db } from '@/core/db/client'
import { notesTable, usersTable } from '@/core/db/schema'
import { logger } from '@/core/logger'

// Run by `bun run db:seed`, and by db:reset after the migrations.

const [demoUser] = await db
	.insert(usersTable)
	.values({
		name: 'Demo User',
		// email is sample profile data here — it isn't the sign-in identity.
		// core/auth/otp.ts is what phone-otp actually checks, and it accepts this
		// phone with the fixed demo code (see that file).
		email: 'demo@example.com',
		phone: '13800000000',
	})
	.returning()

await db.insert(notesTable).values([
	{ userId: demoUser.id, title: 'Welcome', body: 'This is a seeded note.' },
	{
		userId: demoUser.id,
		title: 'Second note',
		body: 'Try toggling this one done.',
	},
])

logger.info({ userId: demoUser.id }, 'seed data inserted')
