const fs = require('fs');
const glob = require('glob');

// This script will find common Romanian UI terms in JSX files and attempt to wrap them in t('Romanian', 'English', 'Russian')
// if the file uses `const t = (ro, en, ru)`. But files use different `t` implementations.
