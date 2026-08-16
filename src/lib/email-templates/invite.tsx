import * as React from 'react'
import { Body, Button, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { BrandShell } from './_shell'
import { button, h1, link, main, text } from './_styles'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>لقد تمت دعوتك للانضمام إلى {siteName}</Preview>
    <Body style={main}>
      <BrandShell siteName={siteName}>
        <Heading style={h1}>دعوة للانضمام 🎉</Heading>
        <Text style={text}>
          لقد تمت دعوتك للانضمام إلى{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>{' '}
          — منصة إدارة الصيدليات الذكية. اضغط على الزر أدناه لقبول الدعوة وإنشاء حسابك.
        </Text>
        <Button style={button} href={confirmationUrl}>قبول الدعوة</Button>
        <Text style={{ ...text, marginTop: 24, fontSize: 13 }}>
          إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة بأمان.
        </Text>
      </BrandShell>
    </Body>
  </Html>
)

export default InviteEmail
