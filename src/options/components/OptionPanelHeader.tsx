import {
  OPTION_PANEL_DESCRIPTION_CLASS,
  OPTION_PANEL_HEADER_CLASS,
  OPTION_PANEL_TITLE_CLASS
} from './option-layout-classes.js'

interface OptionPanelHeaderProps {
  description: string
  title: string
  titleId: string
}

export function OptionPanelHeader({ description, title, titleId }: OptionPanelHeaderProps) {
  return (
    <header className={OPTION_PANEL_HEADER_CLASS}>
      <h1 id={titleId} className={OPTION_PANEL_TITLE_CLASS}>{title}</h1>
      <p className={OPTION_PANEL_DESCRIPTION_CLASS}>{description}</p>
    </header>
  )
}
