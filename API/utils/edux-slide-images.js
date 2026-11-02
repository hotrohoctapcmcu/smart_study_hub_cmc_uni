'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

function imageDirectory() {
    return process.env.EDUX_IMAGES_PATH || path.join(process.env.DB_PATH
        ? path.dirname(path.resolve(process.env.DB_PATH)) : path.resolve(__dirname, '../../data'), 'edux-images');
}

// EDUX can return either a data URI or an unprefixed image_base64 string.
function rasterImage(value) {
    if (typeof value !== 'string') return null;
    const source = value.trim();
    const match = source.match(/^data:image\/(?:png|jpe?g|webp|gif);base64,([\s\S]+)$/i);
    const base64 = (match ? match[1] : source).replace(/\s/g, '');
    if (!/^[a-z\d+/]+={0,2}$/i.test(base64) || base64.length < 16 || base64.length % 4 === 1) return null;
    const bytes = Buffer.from(base64, 'base64');
    let extension;
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) extension = 'png';
    else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) extension = 'jpg';
    else if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) extension = 'gif';
    else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') extension = 'webp';
    return extension ? { bytes, extension } : null;
}

async function cacheSlideImages(value, { directory = imageDirectory(), prefix = '/api/v1/learning/images' } = {}) {
    const images = new Set();
    async function save(source) {
        const image = rasterImage(source);
        if (!image) return '';
        const name = `${createHash('sha256').update(image.bytes).digest('hex')}.${image.extension}`;
        await fs.mkdir(directory, { recursive: true });
        try { await fs.writeFile(path.join(directory, name), image.bytes, { flag: 'wx' }); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
        const url = `${prefix}/${name}`;
        images.add(url);
        return url;
    }
    async function walk(node, depth = 0) {
        if (depth > 40 || node == null) return node;
        if (typeof node === 'string') {
            const image = await save(node);
            if (image) return image;
            if (/^[\[{]/.test(node.trim())) {
                try { return JSON.stringify(await walk(JSON.parse(node), depth + 1)); }
                catch (error) { if (!(error instanceof SyntaxError)) throw error; }
            }
            // Images embedded in HTML/Markdown/editor content are cached too.
            let result = node;
            for (const match of node.matchAll(/data:image\/(?:png|jpe?g|webp|gif);base64,[a-z\d+/=]+/gi)) {
                const url = await save(match[0]);
                if (url) result = result.replaceAll(match[0], url);
            }
            return result;
        }
        if (Array.isArray(node)) return Promise.all(node.map(item => walk(item, depth + 1)));
        if (typeof node !== 'object') return node;
        const result = {};
        for (const [key, item] of Object.entries(node)) {
            if (/^image_?base64$/i.test(key)) {
                // Never keep a large binary field in chapters_json or AI text.
                await save(item);
            } else result[key] = await walk(item, depth + 1);
        }
        return result;
    }
    const content = await walk(value);
    return { content, images: [...images] };
}

module.exports = { imageDirectory, rasterImage, cacheSlideImages };
