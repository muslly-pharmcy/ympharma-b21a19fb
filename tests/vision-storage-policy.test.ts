import { describe, expect, it } from 'vitest'
import { assertOwnVisionObject } from '@/lib/vision-storage-policy'

const user = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
describe('private OCR object ownership', () => {
  it.each(['prescriptions', 'invoice-uploads'])('allows only a canonical own upload in %s', (bucket) => {
    expect(() => assertOwnVisionObject(user, bucket, `${user}/1780000000000-image.png`)).not.toThrow()
  })
  it.each([
    ['prescriptions', `${other}/image.png`],
    ['prescriptions', `${user}-other/image.png`],
    ['prescriptions', `${user}/../image.png`],
    ['prescriptions', `${user}/%2e%2e%2fimage.png`],
    ['prescriptions', `${user}/%252e%252e.png`],
    ['prescriptions', `${user}/folder/image.png`],
    ['prescriptions', `${user}//image.png`],
    ['prescriptions', `${user}/image\\other.png`],
    ['prescriptions', `${user}/image.png?token=secret`],
    ['prescriptions', `https://storage.example.test/${user}/image.png`],
    ['prescriptions', `${user}/image\u0000.png`],
    ['prescriptions', `${user}/${'x'.repeat(500)}.png`],
    ['product-images', `${user}/image.png`],
    ['patient-records', `${user}/image.png`],
  ])('rejects other users and ambiguous paths in %s', (bucket, path) => {
    expect(() => assertOwnVisionObject(user, bucket, path)).toThrow()
  })
  it('rejects an invalid verified-user identifier rather than widening access', () => {
    expect(() => assertOwnVisionObject('', 'prescriptions', '/image.png')).toThrow()
  })
})
