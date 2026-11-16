# Jig

**Just in time daily planner.** A small nudge to get you on track: plan each day, put lightweight intentions in order, and freely reorganize them as work changes.

Jig is a standalone, local-first desktop planner with a dated weekly Kanban board, a focused day view, carried-forward unfinished work, optional priorities/reminders, confirmed deletion and completed history. Details of project work remain in their own systems.

**Designed installation:** One Linux installer connects Jig to your selected personal Git repository, places the operational SQLite database and portable task data inside its Jig subdirectory, installs the `jig` launcher and configures a background user service. Edits save locally immediately; Jig automatically version-controls and synchronizes its own records through an isolated data branch of that same repository. An independent phone app and multi-writer conflict resolution are future capabilities.

## Documentation

- [Documentation index and ownership](docs/README.md)
- [Product definition](docs/product/product-definition.md)
- [Functional requirements — JIG-FR-01–22](docs/requirements/planning-workbench.md)
- [Complete technical solution](docs/architecture/technical-solution.md)
- [UI solution and visual mockups](docs/design/ui-solution.md)

**Status:** Proposed design baseline. The application, installer and service have not been implemented or runtime-certified.

## License

Apache-2.0; see [LICENSE](LICENSE).
