#!/bin/zsh
set -eu

source_app=__SOURCE_APP__
extension_dir=__EXTENSION_DIR__
launcher_dir="${0:A:h}"
resources_dir="${launcher_dir:h}/Resources"
data_dir="$HOME/Library/Application Support/Codex-WebMCP"
profile_dir="$data_dir/Profile"
runtime_dir="$data_dir/Runtime"

fail() {
  /usr/bin/osascript \
    -e 'on run argv' \
    -e 'display alert "Codex WebMCP" message (item 1 of argv) as critical' \
    -e 'end run' \
    "$1"
  exit 1
}

plist_value() {
  /usr/bin/plutil -extract "$2" raw -o - "$1" 2>/dev/null || true
}

[[ -x "$source_app/Contents/MacOS/ChatGPT" ]] || fail "Codex was not found at $source_app."
[[ -f "$extension_dir/manifest.json" ]] || fail "The extension build was not found at $extension_dir."

source_info="$source_app/Contents/Info.plist"
source_version=$(plist_value "$source_info" CFBundleShortVersionString)
source_build=$(plist_value "$source_info" CFBundleVersion)
[[ -n "$source_version" && -n "$source_build" ]] || fail "Could not determine the installed Codex version."

runtime_key="$source_version-$source_build"
runtime_app="$runtime_dir/ChatGPT-$runtime_key.app"
staged_app="$runtime_dir/.ChatGPT-$runtime_key.building.app"
runtime_info="$runtime_app/Contents/Info.plist"

/bin/mkdir -p "$profile_dir" "$runtime_dir"

runtime_version=$(plist_value "$runtime_info" CFBundleShortVersionString)
runtime_build=$(plist_value "$runtime_info" CFBundleVersion)

if [[ "$runtime_version" != "$source_version" || "$runtime_build" != "$source_build" ]]; then
  /bin/rm -rf -- "$runtime_app" "$staged_app"
  if ! /bin/cp -cR "$source_app" "$staged_app"; then
    /bin/rm -rf -- "$staged_app"
    /bin/cp -R "$source_app" "$staged_app"
  fi
  /usr/bin/codesign --verify --deep --strict "$staged_app" || fail "The copied Codex runtime failed signature verification."
  /bin/mv "$staged_app" "$runtime_app"
fi

exec "$runtime_app/Contents/MacOS/ChatGPT" \
  --user-data-dir="$profile_dir" \
  --load-extension="$extension_dir" \
  --enable-features=WebMCPTesting
