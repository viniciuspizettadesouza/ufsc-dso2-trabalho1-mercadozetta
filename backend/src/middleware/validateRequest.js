function validateRequest(schema = {}) {
    return function requestValidator(req, res, next) {
        try {
            req.validated = {
                ...(req.validated || {}),
            };

            if (schema.body)
                req.validated.body = schema.body(req.body);

            if (schema.params)
                req.validated.params = schema.params(req.params);

            if (schema.query)
                req.validated.query = schema.query(req.query);

            return next();
        } catch (err) {
            return next(err);
        }
    };
}

module.exports = validateRequest;
