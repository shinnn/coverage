workflow "Test" {
  on = "push"
  resolves = ["Test (latest)", "Test (stable)"]
}

action "Install" {
  uses = "shinnn/actions-npm-alpine@master"
  args = "install-ci"
}

action "Test (latest)" {
  uses = "shinnn/actions-npm-alpine@master"
  needs = ["Install"]
  args = "test"
  secrets = ["CODECOV_TOKEN"]
}

action "Test (stable)" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  needs = ["Install"]
  args = "test"
  secrets = ["CODECOV_TOKEN"]
}
