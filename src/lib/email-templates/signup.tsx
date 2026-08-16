import * as React from 'react'
import { Body, Button, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { BrandShell } from './_shell'
import { button, h1, link, main, text } from './_styles'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تأكيد بريدك الإلكتروني في {siteName}</Preview>
    <Body style={main}>
      <BrandShell siteName={siteName}>
        <Heading style={h1}>مرحباً بك في {siteName} 👋</Heading>
        <Text style={text}>
          شكراً لتسجيلك في{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . يُرجى تأكيد بريدك الإلكتروني ({recipient}) بالضغط على الزر أدناه للبدء باستخدام حسابك.
        </Text>
        <Button style={button} href={confirmationUrl}>تأكيد البريد الإلكتروني</Button>
        <Text style={{ ...text, marginTop: 24, fontSize: 13 }}>
          إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة بأمان.
        </Text>
      </BrandShell>
    </Body>
  </Html>
)

export default SignupEmail
