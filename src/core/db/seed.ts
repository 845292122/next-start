import { hashPassword } from '@/core/auth/password'
import { db } from '@/core/db/client'
import { notesTable, usersTable } from '@/core/db/schema'
import { logger } from '@/core/logger'

// Run by `bun run db:seed`, and by db:reset after the migrations.

const [demoUser] = await db
	.insert(usersTable)
	.values({
		name: 'Demo User',
		email: 'demo@example.com',
		passwordHash: await hashPassword('demo1234'),
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
