workflow "Test" {
  on = "push"
  resolves = ["Test (without Git)", "Test (with Git)"]
}

action "Install" {
  uses = "docker://node:alpine"
  runs = "npm"
  args = "ci"
}

action "Test (without Git)" {
  uses = "docker://node:alpine"
  needs = ["Install"]
  runs = "npm"
  args = "test"
  secrets = ["CODECOV_TOKEN"]
}

action "Test (with Git)" {
  uses = "docker://node"
  needs = ["Install"]
  runs = "npm"
  args = "test"
  secrets = ["CODECOV_TOKEN"]
}
