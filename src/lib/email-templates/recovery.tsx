import * as React from 'react'
import { Body, Button, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { BrandShell } from './_shell'
import { button, h1, main, text } from './_styles'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>إعادة تعيين كلمة المرور — {siteName}</Preview>
    <Body style={main}>
      <BrandShell siteName={siteName}>
        <Heading style={h1}>إعادة تعيين كلمة المرور</Heading>
        <Text style={text}>
          استلمنا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في {siteName}. اضغط على الزر أدناه لاختيار كلمة مرور جديدة.
        </Text>
        <Button style={button} href={confirmationUrl}>إعادة تعيين كلمة المرور</Button>
        <Text style={{ ...text, marginTop: 24, fontSize: 13 }}>
          إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة ولن يتم تغيير كلمة المرور.
        </Text>
      </BrandShell>
    </Body>
  </Html>
)

export default RecoveryEmail
