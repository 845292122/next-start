import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Text,
} from '@react-email/components'

export function WelcomeEmail({ name }: { name: string }) {
	return (
		<Html>
			<Head />
			<Body>
				<Container>
					<Heading>Welcome, {name}!</Heading>
					<Text>Thanks for signing up.</Text>
				</Container>
			</Body>
		</Html>
	)
}

export default WelcomeEmail
