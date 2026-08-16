import * as React from 'react'
import { Container, Section, Text } from '@react-email/components'
import { brandName, brandTag, card, container, footer, header } from './_styles'

export function BrandShell({
  siteName,
  children,
}: {
  siteName: string
  children: React.ReactNode
}) {
  return (
    <Container style={container}>
      <Section style={card}>
        <Section style={header}>
          <Text style={brandName}>{siteName}</Text>
          <Text style={brandTag}>نظام الصيدلة الذكي — MUSLLY AI OS</Text>
        </Section>
        {children}
      </Section>
      <Text style={footer}>
        © {new Date().getFullYear()} {siteName} — جميع الحقوق محفوظة.
        <br />
        هذه رسالة تلقائية، الرجاء عدم الرد عليها.
      </Text>
    </Container>
  )
}
