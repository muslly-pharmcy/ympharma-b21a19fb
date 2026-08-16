import * as React from 'react'
import { Body, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { BrandShell } from './_shell'
import { codeStyle, h1, main, text } from './_styles'

interface ReauthenticationEmailProps {
  siteName?: string
  token: string
}

export const ReauthenticationEmail = ({
  siteName = 'MUSLLY',
  token,
}: ReauthenticationEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>رمز التحقق الخاص بك</Preview>
    <Body style={main}>
      <BrandShell siteName={siteName}>
        <Heading style={h1}>رمز التحقق</Heading>
        <Text style={text}>استخدم الرمز التالي لتأكيد هويتك:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={{ ...text, fontSize: 13 }}>
          هذا الرمز صالح لفترة قصيرة. إذا لم تطلبه، يمكنك تجاهل هذه الرسالة.
        </Text>
      </BrandShell>
    </Body>
  </Html>
)

export default ReauthenticationEmail
