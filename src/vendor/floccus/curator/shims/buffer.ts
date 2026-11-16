/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * isomorphic-git, which the Git adapter uses, expects Node's Buffer as a
 * global. floccus provides it through webpack; here esbuild injects this
 * export wherever `Buffer` is referenced.
 */
export { Buffer } from 'buffer'
