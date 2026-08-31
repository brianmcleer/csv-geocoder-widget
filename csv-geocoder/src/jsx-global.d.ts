/**
 * Global JSX namespace shim for @types/react v19 + Emotion css prop.
 *
 * ArcGIS Experience Builder 1.21 ships @types/react 19, which removed the
 * global `JSX` namespace (it now lives at `React.JSX`). This widget uses the
 * classic JSX factory (`@jsx jsx` from jimu-core / Emotion), and TypeScript
 * types classic-factory JSX against the GLOBAL `JSX` namespace. Without this
 * shim, every element reports:
 *
 *   "JSX element implicitly has type 'any' because no interface
 *    'JSX.IntrinsicElements' exists."
 *
 * The `declare module 'react'` block re-applies Emotion's css-prop
 * augmentation to THIS widget's local copy of @types/react. jimu-core's
 * Emotion integration augments the client's copy, but ExB 1.21's pnpm
 * layout hides that copy from the IDE, so the widget carries its own
 * types (see package.json devDependencies) and needs its own augmentation.
 *
 * Safe to delete once jimu's jsx factory carries its own JSX namespace, or
 * if this widget migrates to the automatic JSX runtime.
 */
import type * as React from 'react'

declare global {
    namespace JSX {
        type ElementType = React.JSX.ElementType
        interface Element extends React.JSX.Element { }
        interface ElementClass extends React.JSX.ElementClass { }
        interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty { }
        interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute { }
        type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>
        interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes { }
        interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> { }
        interface IntrinsicElements extends React.JSX.IntrinsicElements { }
    }
}

declare module 'react' {
    interface Attributes {
        /**
         * Emotion css prop, provided at runtime by the `@jsx jsx` factory from
         * jimu-core. Typed as `unknown` so any `css\`...\`` template result is
         * accepted without pulling @emotion/react types into the widget.
         */
        css?: unknown
    }
}

export { }