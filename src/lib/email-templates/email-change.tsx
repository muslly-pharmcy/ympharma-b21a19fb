import * as React from 'react'
import { Body, Button, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { BrandShell } from './_shell'
import { button, h1, link, main, text } from './_styles'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تأكيد تغيير البريد الإلكتروني — {siteName}</Preview>
    <Body style={main}>
      <BrandShell siteName={siteName}>
        <Heading style={h1}>تأكيد تغيير البريد الإلكتروني</Heading>
        <Text style={text}>
          طلبت تغيير البريد الإلكتروني لحسابك في {siteName} من{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link>{' '}
          إلى{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>اضغط على الزر أدناه لتأكيد هذا التغيير:</Text>
        <Button style={button} href={confirmationUrl}>تأكيد التغيير</Button>
        <Text style={{ ...text, marginTop: 24, fontSize: 13 }}>
          إذا لم تطلب هذا التغيير، يُرجى تأمين حسابك فوراً بتغيير كلمة المرور.
        </Text>
      </BrandShell>
    </Body>
  </Html>
)

export default EmailChangeEmail
