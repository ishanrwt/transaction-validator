const { buildRules } = require("./ruleRegistry");

// Some rules compute severity dynamically based on row context.
function resolveSeverity(rule, value, row) {
  if (typeof rule.severity === "function") {
    return rule.severity(value, row);
  }
  return rule.severity;
}

// Messages can also be dynamic when the exact failure reason depends on the row.
function resolveMessage(rule, value, row) {
  if (typeof rule.message === "function") {
    return rule.message(value, row);
  }
  return rule.message;
}

function runRules(row, rowIndex, config) {
  const rules = buildRules(config);
  const errors = [];

  // Rules decide whether they apply through condition(), then report failures via validate().
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
