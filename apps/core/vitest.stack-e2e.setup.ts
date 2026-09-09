import { beforeEach } from 'vitest'

const stackSkipReason = process.env['STACK_E2E_SKIP_REASON']

if (typeof stackSkipReason === 'string' && stackSkipReason.length > 0) {
  beforeEach((context) => {
    context.skip(stackSkipReason)
  })
}
