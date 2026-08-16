import * as React from 'react'
import { Body, Button, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { BrandShell } from './_shell'
import { button, h1, main, text } from './_styles'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>رابط الدخول إلى {siteName}</Preview>
    <Body style={main}>
      <BrandShell siteName={siteName}>
        <Heading style={h1}>رابط الدخول السريع</Heading>
        <Text style={text}>
          اضغط على الزر أدناه لتسجيل الدخول إلى {siteName}. هذا الرابط صالح لفترة قصيرة فقط لحماية حسابك.
        </Text>
        <Button style={button} href={confirmationUrl}>تسجيل الدخول</Button>
        <Text style={{ ...text, marginTop: 24, fontSize: 13 }}>
          إذا لم تطلب رابط الدخول هذا، يمكنك تجاهل الرسالة.
        </Text>
      </BrandShell>
    </Body>
  </Html>
)

export default MagicLinkEmail
