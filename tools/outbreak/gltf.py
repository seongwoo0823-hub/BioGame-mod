# Kenney GLB/GLTF 읽기: 노드 변환을 적용해 (재질별) 꼭짓점·삼각형을 모음
import json, struct, os, numpy as np
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def load(path):
    b = open(path, 'rb').read()
    if b[:4] == b'glTF':
        l = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + l]); o = 20 + l
        bins = [b[o + 8:o + 8 + struct.unpack('<I', b[o:o + 4])[0]]] if o < len(b) else []
    else:
        j = json.loads(b); d = os.path.dirname(path); bins = [open(os.path.join(d, bf['uri']), 'rb').read() for bf in j['buffers']]
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; buf = bins[bv.get('buffer', 0)]
        n = NC[a['type']]; dt = CT[a['componentType']]; off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        st = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize * n
        if st and st != isz:
            arr = np.frombuffer(buf, np.uint8, count=st * (a['count'] - 1) + isz, offset=off)
            arr = np.stack([np.frombuffer(arr[k * st:k * st + isz].tobytes(), dt) for k in range(a['count'])])
        else: arr = np.frombuffer(buf, dt, count=a['count'] * n, offset=off).reshape(a['count'], n)
        arr = arr.astype(np.float32)
        if a.get('normalized'): arr /= {np.int8: 127, np.uint8: 255, np.int16: 32767, np.uint16: 65535}[dt]
        return arr
    def mat4(nd):
        if 'matrix' in nd: return np.array(nd['matrix'], np.float64).reshape(4, 4).T
        t = nd.get('translation', [0, 0, 0]); r = nd.get('rotation', [0, 0, 0, 1]); s = nd.get('scale', [1, 1, 1])
        x, y, z, w = r
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        M = np.eye(4); M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M
    mats = []
    for m in j.get('materials', []):
        p = m.get('pbrMetallicRoughness', {}); tex = None
        if 'baseColorTexture' in p:
            ti = j['textures'][p['baseColorTexture']['index']]; im = j['images'][ti['source']]; tex = os.path.basename(im.get('uri', im.get('name', 'img')))
        mats.append((tex, p.get('baseColorFactor', [1, 1, 1, 1]), m.get('name', '')))
    out = {}   # matIndex → [pos, nrm, uv, idx]
    def walk(ni, P):
        nd = j['nodes'][ni]; M = P @ mat4(nd)
        if 'mesh' in nd:
            for pr in j['meshes'][nd['mesh']]['primitives']:
                at = pr['attributes']; pos = acc(at['POSITION'])
                nrm = acc(at['NORMAL']) if 'NORMAL' in at else np.zeros_like(pos)
                uv = acc(at['TEXCOORD_0']) if 'TEXCOORD_0' in at else np.zeros((len(pos), 2), np.float32)
                idx = acc(pr['indices']).astype(np.int64).ravel() if 'indices' in pr else np.arange(len(pos))
                p4 = np.c_[pos, np.ones(len(pos))] @ M.T; N3 = np.linalg.inv(M[:3, :3]).T
                n = nrm @ N3.T; n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
                if np.linalg.det(M[:3, :3]) < 0: idx = idx.reshape(-1, 3)[:, ::-1].ravel()
                L = out.setdefault(pr.get('material', -1), [[], [], [], [], 0])
                L[0].append(p4[:, :3]); L[1].append(n); L[2].append(uv); L[3].append(idx + L[4]); L[4] += len(pos)
        for c in nd.get('children', []): walk(c, M)
    sc = j['scenes'][j.get('scene', 0)]
    for ni in sc['nodes']: walk(ni, np.eye(4))
    groups = []
    for mi, L in out.items():
        groups.append(dict(mat=mats[mi] if mi >= 0 else (None, [1, 1, 1, 1], ''), pos=np.concatenate(L[0]).astype(np.float32), nrm=np.concatenate(L[1]).astype(np.float32), uv=np.concatenate(L[2]).astype(np.float32), idx=np.concatenate(L[3])))
    return groups
