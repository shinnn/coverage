workflow "Test" {
  on = "push"
  resolves = ["Test (latest)", "Test (stable)"]
}

action "Install" {
  uses = "docker://node:alpine"
  runs = "npm"
  args = "ci"
}

action "Test (latest)" {
  uses = "docker://node:alpine"
  needs = ["Install"]
  runs = "npm"
  args = "test"
  secrets = ["CODECOV_TOKEN"]
}

action "Test (stable)" {
  uses = "docker://node:10"
  needs = ["Install"]
  runs = "npm"
  args = "test"
  secrets = ["CODECOV_TOKEN"]
}
