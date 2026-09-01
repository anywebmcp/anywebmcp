#include <libgen.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(void) {
  char executable[PATH_MAX];
  char resolved[PATH_MAX];
  char script[PATH_MAX];
  uint32_t size = sizeof(executable);

  if (_NSGetExecutablePath(executable, &size) != 0 || !realpath(executable, resolved)) {
    fputs("Could not locate the AnyWebMCP Codex Launcher.\n", stderr);
    return 1;
  }
  if (snprintf(script, sizeof(script), "%s/../Resources/launcher.zsh", dirname(resolved)) >= (int)sizeof(script)) {
    fputs("The AnyWebMCP Codex Launcher path is too long.\n", stderr);
    return 1;
  }

  execl("/bin/zsh", "zsh", "-f", script, (char *)NULL);
  perror("Could not start the AnyWebMCP Codex Launcher");
  return 1;
}
