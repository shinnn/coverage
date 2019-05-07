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
  runs = "bash"
  args = "-c \"npx c8 node . echo Test for codecov-bash on GitHub Actions && npx c8 report --reporter=text-lcov > coverage.lcov && bash <(curl -s https://codecov.io/bash) -X gcov -f coverage.lcov\""
  secrets = ["CODECOV_TOKEN"]
}
