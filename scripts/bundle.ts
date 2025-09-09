import path from 'path'
import fs from 'fs'

import { bundleLua } from './util/lua-bundler'

const logger = console

async function bundle() {
    const modules = [
        { path: 'bucket_stock_module', name: 'bucket_stock', stringifySource: true },
        { path: 'mock_usd_module', name: 'mock_usd', stringifySource: true },
        { path: 'yield_bet_module', name: 'yield_bet', stringifySource: true },
    ]

    for (const module of modules) {

        logger.info(`Bundling Lua for ${module.name}...`)

        const luaEntryPath = path.join(
            path.resolve(),
            `./src/contracts/${module.path}/${module.name}.lua`
        )
        if (!fs.existsSync(luaEntryPath)) {
            throw new Error(`Lua entry path not found: ${luaEntryPath}`)
        }

        const bundledLua = bundleLua(luaEntryPath)
        if (!fs.existsSync(path.join(path.resolve(), `./dist/${module.path}`))) {
            fs.mkdirSync(
            path.join(path.resolve(), `./dist/${module.path}`),
            { recursive: true }
            )
        }
        fs.writeFileSync(
            path.join(path.resolve(), `./dist/${module.path}/process.lua`),
            bundledLua
        )

        fs.copyFileSync('./src/lib/hyper-aos.lua', `./dist/${module.path}/ao.lua`)

        if (module.stringifySource) {
            const base64Code = Buffer.from(bundledLua, 'utf-8').toString('base64')
            const stringifiedSource =
            `local CodeString = '${base64Code}'\nreturn CodeString`
            fs.writeFileSync(
                path.join(
                    path.resolve(),
                    `./src/contracts/${module.path}/${module.name}-stringified.lua`
                ),
                stringifiedSource
            )
        }

        logger.info(`Done Bundling Lua for ${module.name}!`)
    }
}

bundle()
  .then()
  .catch(err => logger.error(`Error bundling Lua: ${err.message}`, err.stack))