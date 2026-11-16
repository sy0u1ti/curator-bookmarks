/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Curator replacement for floccus' src/lib/native/I18n.ts.
 *
 * The original loads floccus' _locales through webpack's require.context and
 * formats them with intl-messageformat. Curator has one interface language and
 * needs only the messages the engine itself produces, so they are bundled
 * directly and `{0}`-style placeholders are filled in here.
 */
import { MESSAGES } from '../../../curator/messages'

export default class I18n {
  setLocales(_locales: readonly string[]): void {
    // One language
  }

  async load(): Promise<void> {
    // Bundled
  }

  getLocale(): string {
    return 'zh-CN'
  }

  isRTL(): boolean {
    return false
  }

  /**
   * Get a formatted message with the given name. An unknown name is returned
   * as it is, which is what floccus does as well.
   */
  getMessage(messageName: string, content?: unknown): string {
    const template = Object.prototype.hasOwnProperty.call(MESSAGES, messageName)
      ? MESSAGES[messageName]
      : null
    if (template === null) {
      return messageName
    }
    const values = Array.isArray(content) ? content : content === undefined ? [] : [content]
    return template.replace(/\{(\d+)\}/g, (_placeholder, index) => {
      const value = values[Number(index)]
      return value === undefined || value === null ? '' : String(value)
    })
  }
}

export const i18n = new I18n()
