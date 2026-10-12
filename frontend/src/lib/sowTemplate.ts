/**
 * The skeleton every Project Lab SOW starts from ("Insert template" in the
 * editor). It follows what a real statement of work contains — background,
 * objectives, in/out of scope, requirements, deliverables, acceptance criteria,
 * assumptions — so a student learns to read a spec the way they will at work.
 * "Out of scope" is deliberately its own heading: it prevents more
 * misunderstandings than any other section.
 *
 * The milestones are NOT written here. They are entered as structured rows next
 * to the SOW (title, description, acceptance criteria, hours) because progress
 * and review are tracked against them; the PDF appends them automatically.
 */
export const SOW_TEMPLATE = `# Statement of Work

## 1. Background

Who needs this system and why. Two or three sentences of context a new team member would be told on day one.

## 2. Objectives

What this project must achieve, as outcomes rather than features.

- Objective one
- Objective two

## 3. Scope

### In scope

- Everything the student must build

### Out of scope

- What is deliberately not part of this project (payments, mobile apps, deployment…)

## 4. Users and roles

| Role | What they can do |
| --- | --- |
| Admin | … |
| User | … |

## 5. Functional requirements

Group by module. Number them so they can be referred to in review.

### 5.1 Module name

- **FR-1** The system shall …
- **FR-2** The system shall …

## 6. Non-functional requirements

- **Security:** passwords hashed, authorisation enforced on the server, no secrets in the repository
- **Validation:** all input validated; helpful error messages
- **Quality:** consistent code style, meaningful commit history, README with setup steps

## 7. Data model

The entities the student must model and how they relate. Include a table list or an ER description.

## 8. Interfaces

The pages, screens or API endpoints the finished system exposes.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/… | … |

## 9. Technology and constraints

- Recommended stack: …
- Constraints: …

## 10. Deliverables

- Source code in the workspace, submitted from Project Lab
- A \`README.md\` explaining how to install and run it
- A \`.env.example\` listing every setting the project needs
- Seed data or a script that creates a usable demo

## 11. Evaluation

How the submission is judged: each milestone's acceptance criteria are checked, then overall quality (security, structure, readability, completeness) is scored out of 100.

## 12. Assumptions

- Anything the student may take as given

## 13. Resources

- Links to documentation, design references, sample data
`;
