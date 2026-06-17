const { buildRules } = require("./ruleRegistry");

function resolveSeverity(rule, value, row) {
  if (typeof rule.severity === "function") {
    return rule.severity(value, row);
  }
  return rule.severity;
}

function resolveMessage(rule, value, row) {
  if (typeof rule.message === "function") {
    return rule.message(value, row);
  }
  return rule.message;
}

function runRules(row, rowIndex, config) {
  const rules = buildRules(config);
  const errors = [];

  for (const rule of rules) {
    const value = row[rule.field];

    if (!rule.condition(value, row)) {
      continue;
    }

    if (!rule.validate(value, row)) {
      errors.push({
        field: rule.field,
        value,
        rule_id: rule.id,
        severity: resolveSeverity(rule, value, row),
        message: resolveMessage(rule, value, row),
      });
    }
  }

  return errors;
}

module.exports = { runRules };
