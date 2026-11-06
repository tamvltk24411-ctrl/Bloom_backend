const test = require('node:test');
const assert = require('node:assert/strict');
const errorMiddleware = require('../middlewares/error.middleware');

function invokeMiddleware(error, headersSent = false) {
  const result = {};
  const res = {
    headersSent,
    status(status) {
      result.status = status;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };
  let forwardedError;

  errorMiddleware(error, {}, res, nextError => {
    forwardedError = nextError;
  });

  return { ...result, forwardedError };
}

test('maps Mongoose and malformed JSON errors to the standard error envelope', () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const cases = [
      [{ name: 'ValidationError' }, 400],
      [{ name: 'CastError' }, 400],
      [{ code: 11000 }, 409],
      [{ type: 'entity.parse.failed', status: 400 }, 400],
      [new Error('internal details'), 500]
    ];

    for (const [error, status] of cases) {
      const result = invokeMiddleware(error);
      assert.equal(result.status, status);
      assert.deepEqual(Object.keys(result.body).sort(), ['data', 'message', 'success']);
      assert.equal(result.body.success, false);
      assert.equal(result.body.data, null);
      assert.equal(JSON.stringify(result.body).includes('internal details'), false);
    }
  } finally {
    console.error = originalError;
  }
});

test('forwards errors when response headers have already been sent', () => {
  const error = new Error('stream failed');
  const result = invokeMiddleware(error, true);

  assert.equal(result.forwardedError, error);
  assert.equal(result.body, undefined);
});
