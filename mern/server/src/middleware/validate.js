/**
 * Validates request parts with zod. Schemas are strict, so unknown fields (and
 * therefore NoSQL operator payloads like {"$gt": ""}) are rejected outright.
 * Parsed values are placed on req.body / req.valid.{params,query}.
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
  if (schemas.params) req.valid.params = schemas.params.parse(req.params);
  if (schemas.query) req.valid.query = schemas.query.parse(req.query);
  next();
};
