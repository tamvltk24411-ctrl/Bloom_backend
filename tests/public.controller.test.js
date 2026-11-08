const test = require('node:test');
const assert = require('node:assert/strict');
const Article = require('../models/Article');
const publicController = require('../controllers/public.controller');

test('public article list only queries published articles and preserves category filter', async t => {
  let query;
  let populateArguments;
  t.mock.method(Article, 'find', filter => {
    query = filter;
    return {
      populate: async (...args) => {
        populateArguments = args;
        return [{ title: 'Published article' }];
      }
    };
  });

  const response = {};
  const res = {
    json(body) {
      response.body = body;
      return this;
    }
  };

  await publicController.getArticles({ query: { category: 'cham-soc-da' } }, res, error => {
    throw error;
  });

  assert.deepEqual(query, {
    $or: [
      { status: 'published' },
      { status: { $exists: false }, isPublished: true }
    ],
    category: 'cham-soc-da'
  });
  assert.deepEqual(populateArguments, ['authorStaffId', 'staffName title avatar']);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.length, 1);
});
