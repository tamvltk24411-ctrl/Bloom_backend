const test = require('node:test');
const assert = require('node:assert/strict');
const openapi = require('../openapi.json');

test('OpenAPI document is valid JSON and declares every API route', () => {
  assert.equal(openapi.openapi, '3.0.3');
  assert.equal(openapi.components.securitySchemes.sessionCookie.name, 'connect.sid');

  const expectedOperations = [
    ['POST', '/api/auth/login'],
    ['POST', '/api/auth/register'],
    ['GET', '/api/auth/profile'],
    ['POST', '/api/auth/logout'],
    ['POST', '/api/auth/change-password'],
    ['GET', '/api/public/services'],
    ['GET', '/api/public/services/{id}'],
    ['GET', '/api/public/staffs'],
    ['GET', '/api/public/professors'],
    ['GET', '/api/public/articles'],
    ['GET', '/api/customer/overview'],
    ['GET', '/api/customer/bookings'],
    ['POST', '/api/customer/bookings'],
    ['PUT', '/api/customer/bookings/{id}/cancel'],
    ['GET', '/api/customer/treatments'],
    ['GET', '/api/admin/dashboard/stats'],
    ['GET', '/api/admin/bookings'],
    ['PATCH', '/api/admin/bookings/{id}/status'],
    ['GET', '/api/admin/staffs'],
    ['POST', '/api/admin/staffs'],
    ['PUT', '/api/admin/staffs/{id}'],
    ['POST', '/api/admin/schedules'],
    ['POST', '/api/admin/pos/checkout'],
    ['POST', '/api/admin/pos/prepaid-wallet'],
    ['POST', '/api/admin/customers'],
    ['POST', '/api/admin/services'],
    ['PUT', '/api/admin/services/{id}'],
    ['DELETE', '/api/admin/services/{id}'],
    ['POST', '/api/admin/products'],
    ['PUT', '/api/admin/products/{id}']
  ];

  for (const [method, path] of expectedOperations) {
    assert.ok(openapi.paths[path]?.[method.toLowerCase()], `${method} ${path} missing from OpenAPI`);
  }
});
