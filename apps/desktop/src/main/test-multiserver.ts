
import { serverManager } from './server'
import http from 'http'

async function test() {
    console.log('Starting Test...')

    // Server A
    const endpointsA = [{
        path: '/hello',
        method: 'GET',
        uriTemplate: 'http://example.com' // Just testing it starts, target might fail if example.com rejects
    }]
    await serverManager.startServer('workspace-a', 3001, endpointsA, {})
    console.log('Server A started on 3001')

    // Server B
    const endpointsB = [{
        path: '/foo',
        method: 'GET',
        uriTemplate: 'http://example.org'
    }]
    await serverManager.startServer('workspace-b', 3002, endpointsB, {})
    console.log('Server B started on 3002')

    // Verify
    const verify = (port: number) => new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
            console.log(`Port ${port} responded with ${res.statusCode}`)
            resolve(true)
        })
        req.on('error', reject)
    })

    try {
        await verify(3001)
        await verify(3002)
        console.log('SUCCESS: Both servers are responding')
    } catch (e) {
        console.error('FAILED:', e)
    }

    await serverManager.stopServer('workspace-a')
    await serverManager.stopServer('workspace-b')
    console.log('Servers stopped')
}

test()
