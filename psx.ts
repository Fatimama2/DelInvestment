// Single import shim for the workspace packages. Importing the shared and
// integrations SOURCE via relative paths keeps tsx/node resolution simple and
// dependency-free (no reliance on package symlinks). The rest of the backend
// imports everything from here.
export * from '../../../packages/shared/src/index';
export * from '../../../packages/integrations/src/index';
