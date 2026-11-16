import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE } from './scene'

// Pearl white by day, black foil by night. The prism supplies the roles, so code reads prismatic.
const { theme, problems } = makeColors({
  label: 'Holo Damascus',
  roles: { accent: '#6a5cff', danger: '#d2443f', success: '#1f9d7a', warning: '#c48a12', pro: '#c24fd6' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#e6e9ef',
        'surface-1': '#eff1f5',
        'surface-2': '#f8f9fb',
        'text-primary': '#1c1e24',
        'text-secondary': '#474b55',
        'text-muted': '#5a5f6b',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0e0f13',
        'surface-1': '#15171c',
        'surface-2': '#1b1e24',
        'surface-3': '#1f2229',
        'text-primary': '#eef0f4',
        'text-secondary': '#c6cad3',
        'text-muted': '#a2a7b2',
      },
    },
  },
})

// The knob for how much the lines show through behind panels: lower opacity = more pattern.
const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'holo-damascus', glass: { blur: 4, opacity: 0.7 } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await $.theme.set(LOOK)

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    // Only draw when the standing theme is ours: another theme mod may have set the look.
    if (e.props.plugin !== 'holo-damascus' || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={SCENE} alt="Fine contour lines with a slow prismatic sheen" isInteractive />
  })
}
