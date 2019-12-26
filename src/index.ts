import * as _utils from './utils'
export const utils = _utils

import * as _plugins from './plugins'
export const plugins = _plugins

export function setLogger(logger: _utils.Logger) {
    utils.logger = logger;
    plugins.logger = logger;
}

export * from './serializer'
export * from './builtin-types'
export * from './barestream'