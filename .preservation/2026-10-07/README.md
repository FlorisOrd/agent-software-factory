# Recover this historical snapshot

This private preservation payload contains original working files and all Git objects from the recorded source repositories, including unreachable history and nested test workspaces. Read the root RESUME.md and MANIFEST.json first. The surrounding preservation branch starts from the latest approved main; unmerged development snapshots are recovered from this archive.

Requires Python 3.9+ and Git. From this directory, run:

```sh
python recover.py --output /an/entirely/new/recovery-directory
```

The output directory must not exist. The helper verifies every archived payload hash, original file hash, object ID/type/size, and Git metadata hash before restoring it. It restores original material and Git working repositories under workspaces/, complete duplicate bare repositories under git-archives/, and original index/HEAD/reflog/custom-hook metadata under git-metadata/. No original raw Git config or credentials are included; remotes and safe scalar configuration are recorded in git/rNNN.json. Custom hooks remain archived for review and are not activated.

The manifest maps each rNNN to its exact original path. Original paths are provenance; restoration writes only beneath the requested new directory. Original malformed historical Git objects are preserved even if they cannot be checked out on some operating systems. Git object recovery and readable working files are distinct guarantees.

For factory development, choose the approved main baseline or explicitly authorized unmerged development branch according to root RESUME.md. Never convert an archived attempt or an old review attestation into an approved release or valid scored run.

DEPENDENCIES.json records original node_modules files compared with fresh locked npm installations. Original files that differed were retained in working-files.zip. Install project dependencies with npm ci --ignore-scripts --no-audit --no-fund, then overlay any listed preserved original dependency metadata if an exact historical recreation is required. Npm content caches are reproducible from the retained lockfiles; installer logs and cache lockfiles are preserved. Any required shared runtimes are installed/restored separately and were not deletion targets.

The evidence/ directory records this cleanup's local restoration checks, including setup failures and successful rechecks. These are separate from original product evidence in working-files.zip. Approval/publication and independent remote-download verification are recorded in the master project-index, not inferred from this local archive.
