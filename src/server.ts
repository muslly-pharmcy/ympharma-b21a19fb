import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

const handler = createStartHandler(defaultStreamHandler)

export default {
  fetch: (request: Request) => {
    const url = new URL(request.url)
    if (url.hostname === 'www.muslly.com') {
      url.hostname = 'muslly.com'
      url.protocol = 'https:'
      url.port = ''
      return Response.redirect(url, 308)
    }
    return handler(request)
  },
}
