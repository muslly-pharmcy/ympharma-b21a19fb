import {fileURLToPath} from 'node:url'
export default {root:fileURLToPath(new URL('.',import.meta.url)),resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},test:{environment:'node',include:['tests/erp-integration.test.ts']}}
