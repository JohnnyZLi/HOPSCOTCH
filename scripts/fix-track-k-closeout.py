from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1))


path = 'src/builder/cli-operations.ts'
text = Path(path).read_text()
if 'function isMutationCommand(' not in text:
    replace_once(
        path,
        """function mutationRequiresDevice(command: BuilderCliMutationCommand): boolean {\n  return command.target !== 'link';\n}\n""",
        """function isMutationCommand(command: BuilderCliSessionCommand): command is BuilderCliMutationCommand {\n  return command.verb === 'set' || command.verb === 'delete';\n}\n\nfunction mutationRequiresDevice(command: BuilderCliMutationCommand): boolean {\n  return command.target !== 'link';\n}\n""",
    )
    replace_once(
        path,
        """  if (!context.mutate) throw new BuilderCliCommandError('READ_ONLY_CONTEXT', context.activeUnavailableReason ?? 'Configuration commands are unavailable in this terminal context.');\n  if (mutationRequiresDevice(command) && !context.currentDeviceId) {\n""",
        """  if (!isMutationCommand(command)) throw new BuilderCliCommandError('UNSUPPORTED_COMMAND', 'Unsupported CLI execution path.');\n  if (!context.mutate) throw new BuilderCliCommandError('READ_ONLY_CONTEXT', context.activeUnavailableReason ?? 'Configuration commands are unavailable in this terminal context.');\n  if (mutationRequiresDevice(command) && !context.currentDeviceId) {\n""",
    )

text = Path(path).read_text()
old = "`SESSIONS · ${sessionRows.length / 2 === 0 && !deviceId ? bgp.sessions.length : sessionRows.length} VIEW${sessionRows.length === 1 ? '' : 'S'}`"
if old in text:
    Path(path).write_text(text.replace(old, "`SESSION VIEWS · ${sessionRows.length}`", 1))

test_path = Path('scripts/builder-cli-contract-check.mjs')
test_text = test_path.read_text()
old_assert = "assert.match(formatBuilderCliSessionShow({ verb: 'show', target: 'bgp' }, operationalState, null), /SESSIONS/, 'BGP CLI view must project canonical BGP state even when empty');"
if old_assert in test_text:
    test_path.write_text(test_text.replace(old_assert, "assert.match(formatBuilderCliSessionShow({ verb: 'show', target: 'bgp' }, operationalState, null), /SESSION VIEWS/, 'BGP CLI view must project canonical BGP state even when empty');", 1))
