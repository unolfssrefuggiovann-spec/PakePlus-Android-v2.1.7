// ------------------------------------------
// 0. Bmob 初始化与全局工具
// ------------------------------------------

const APP_ID  = "407bac41076f421bac8136423a44a878"; 
const REST_KEY = "97e74744e659f76b10f507444f2f192f";

if (typeof Bmob !== 'undefined') {
    Bmob.initialize(APP_ID, REST_KEY);
} else {
    alert("Bmob SDK 加载失败");
}

const Loading = {
    show: (msg) => {
        const overlay = document.getElementById('loading-overlay');
        if(overlay) {
            overlay.querySelector('p').innerText = msg || '正在处理...';
            overlay.classList.remove('hidden');
        }
    },
    hide: () => {
        const overlay = document.getElementById('loading-overlay');
        if(overlay) overlay.classList.add('hidden');
    }
};

// ------------------------------------------
// 🌟 核心：本地数据库工具 (IndexedDB)
// 用于存储大容量图片，替代 Bmob 文件存储
// ------------------------------------------
const DBUtils = {
    dbName: 'LoveSpaceDB',
    version: 1,
    db: null,

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // 创建相册表 (keyPath: id)
                if (!db.objectStoreNames.contains('album')) {
                    db.createObjectStore('album', { keyPath: 'id' });
                }
                // 创建厨房表 (keyPath: id)
                if (!db.objectStoreNames.contains('kitchen')) {
                    db.createObjectStore('kitchen', { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onerror = (e) => reject(e);
        });
    },

    // 保存数据
    save(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(data);
            request.onerror = (e) => reject(e);
        });
    },

    // 获取所有数据
    getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    },

    // 删除数据
    delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }
};

// 🌟 图片处理工具
const ImageHandler = {
    // 读取文件转 Base64 (可选择是否压缩)
    process: (file, shouldCompress = false) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                if (!shouldCompress) {
                    // 不压缩，直接返回原图 Base64 (相册用)
                    resolve(e.target.result);
                } else {
                    // 压缩逻辑 (厨房用)
                    const img = new Image();
                    img.src = e.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        // 限制最大宽度 800px
                        const maxDim = 800;
                        let w = img.width, h = img.height;
                        if (w > h && w > maxDim) { h *= maxDim/w; w = maxDim; }
                        else if (h > maxDim) { w *= maxDim/h; h = maxDim; }
                        
                        canvas.width = w; canvas.height = h;
                        ctx.drawImage(img, 0, 0, w, h);
                        // 质量 0.6
                        resolve(canvas.toDataURL('image/jpeg', 0.6));
                    };
                }
            };
            reader.onerror = reject;
        });
    }
};

// 🌟 文件导出导入工具
const FileSync = {
    exportJSON: (data, filename) => {
        const jsonStr = JSON.stringify(data);
        const blob = new Blob([jsonStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    importJSON: (fileInput) => {
        return new Promise((resolve, reject) => {
            const file = fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) { reject("文件格式错误"); }
            };
            reader.readAsText(file);
        });
    }
};


document.addEventListener('DOMContentLoaded', async () => {
    // 初始化本地数据库
    await DBUtils.init();

    HomeModule.init();
    AlbumModule.init(); // 现在加载本地数据
    TodoModule.init();
    KitchenModule.init(); // 现在加载本地数据
    AnniversaryModule.init();
    HealthModule.init();

    const today = new Date().toISOString().split('T')[0];
    const weightDate = document.getElementById('weight-date');
    if(weightDate) weightDate.value = today;
    const anniDate = document.getElementById('anni-date');
    if(anniDate) anniDate.value = today;
});

function switchModule(moduleId) {
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active-module'));
    document.getElementById(moduleId).classList.add('active-module');
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-item[data-target="${moduleId}"]`);
    if(activeBtn) activeBtn.classList.add('active');

    if(moduleId === 'album') AlbumModule.load();
    if(moduleId === 'todo') TodoModule.load();
    if(moduleId === 'kitchen') KitchenModule.load();
    if(moduleId === 'anniversary') AnniversaryModule.load();
    if(moduleId === 'health') HealthModule.load();
    if(moduleId === 'home') HomeModule.loadDate();
}

// ------------------------------------------
// 1. 主页模块 (Bmob)
// ------------------------------------------
const HomeModule = {
    tableName: 'Love_Settings',
    timerId: null,
    init() { this.loadDate(); this.startQuotes(); },
    async loadDate() {
        const query = Bmob.Query(this.tableName);
        query.equalTo("key", "===", "startDate");
        query.find().then(res => {
            if (res.length > 0) {
                const dateStr = res[0].value;
                document.getElementById('start-date-picker').value = dateStr;
                this.startTimer(dateStr);
            } else {
                document.getElementById('home-settings').classList.remove('hidden');
                document.getElementById('timer-display').innerText = "请设置时间";
            }
        }).catch(err => console.log("获取时间失败", err));
    },
    async saveDate() {
        const dateStr = document.getElementById('start-date-picker').value;
        if(!dateStr) return;
        Loading.show("保存中...");
        const query = Bmob.Query(this.tableName);
        query.equalTo("key", "===", "startDate");
        const res = await query.find();
        if (res.length > 0) {
            const obj = query.get(res[0].objectId);
            obj.set("value", dateStr);
            obj.save().then(() => { Loading.hide(); this.startTimer(dateStr); this.toggleSettings(); alert("同步成功！"); });
        } else {
            const queryNew = Bmob.Query(this.tableName);
            queryNew.set("key", "startDate");
            queryNew.set("value", dateStr);
            queryNew.save().then(() => { Loading.hide(); this.startTimer(dateStr); this.toggleSettings(); });
        }
    },
    toggleSettings() { document.getElementById('home-settings').classList.toggle('hidden'); },
    startTimer(startDateStr) {
        if(!startDateStr) return;
        const update = () => {
            const start = new Date(startDateStr);
            const now = new Date();
            const diff = now - start;
            if (diff < 0) { document.getElementById('timer-display').innerText = "未来可期"; return; }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            document.getElementById('timer-display').innerText = `${days} 天 ${hours} 小时 ${mins} 分`;
        };
        update();
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = setInterval(update, 60000); 
    },
    startQuotes() {
        const quotes = [ "每一个和你在一起的日子，都是奇迹。", "斯人若彩虹，遇上方知有。", "我想和你一起虚度时光。", "醒来觉得甚是爱你。", "喜欢你，是我做过最坚持的事。" ];
        let quoteIndex = 0;
        setInterval(() => {
            quoteIndex = (quoteIndex + 1) % quotes.length;
            const qEl = document.getElementById('love-quote');
            qEl.style.opacity = 0;
            setTimeout(() => { qEl.innerText = `"${quotes[quoteIndex]}"`; qEl.style.opacity = 1; }, 500);
        }, 5000);
    }
};

// ------------------------------------------
// 2. 备忘录模块 (Bmob)
// ------------------------------------------
// ------------------------------------------
// 2. 备忘录模块 (优化版：修复不提醒/无声音问题)
// ------------------------------------------
const TodoModule = {
    todos: [],
    tableName: 'Love_Todo',
    // 使用更稳定的音频源
    alarmSound: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'),
    checkInterval: null,
    isAudioUnlocked: false,

    init() {
        this.load();
        // 提高检测频率到 5秒一次，避免错过整点
        this.checkInterval = setInterval(() => this.checkReminders(), 5000);
        // 每5分钟重新拉取一次数据，保证多端同步
        setInterval(() => this.load(true), 300000);
    },

    load(silent = false) {
        if(!silent) Loading.show();
        const query = Bmob.Query(this.tableName);
        query.order("-createdAt"); 
        query.find().then(res => {
            this.todos = res;
            this.render();
            if(!silent) Loading.hide();
        }).catch(err => { if(!silent) Loading.hide(); console.error(err); });
    },

    add() {
        const text = document.getElementById('todo-input').value;
        const remark = document.getElementById('todo-remark').value;
        const time = document.getElementById('todo-time').value;
        const remindBefore = parseInt(document.getElementById('todo-remind').value);
        const type = document.getElementById('todo-type').value;
        
        if(!text) { alert("请填写要做什么"); return; }

        Loading.show("同步中...");
        const query = Bmob.Query(this.tableName);
        query.set("text", text);
        query.set("remark", remark);
        query.set("time", time);
        query.set("remindBefore", remindBefore);
        query.set("type", type);
        query.set("status", 'pending');
        query.set("notified", false);
        query.save().then(res => {
            this.load(); 
            document.getElementById('todo-input').value = '';
            document.getElementById('todo-remark').value = ''; 
            Loading.hide();
            // 提示用户开启权限，否则可能没声音
            if(!this.isAudioUnlocked) {
                alert("添加成功！⚠️ 请务必点击页面下方的【🔔 开启通知权限】按钮，否则闹钟可能没有声音。");
            }
        });
    },

    delete(objectId) {
        if(!confirm("删除此事项？")) return;
        Loading.show();
        const query = Bmob.Query(this.tableName);
        query.destroy(objectId).then(res => { this.load(); });
    },

    cycleStatus(objectId, currentStatus) {
        let next = 'done';
        if(currentStatus === 'done') next = 'failed';
        if(currentStatus === 'failed') next = 'pending';
        Loading.show("更新状态...");
        const query = Bmob.Query(this.tableName);
        query.get(objectId).then(todo => { todo.set('status', next); todo.save().then(() => this.load()); });
    },

    // 🌟 核心修复：解锁音频播放权限
    requestPermission() {
        // 1. 系统通知权限
        if ("Notification" in window) {
            Notification.requestPermission().then(permission => {
                if(permission === 'granted') {
                    alert("✅ 通知权限已开启\n🔊 音频测试中...");
                    this.unlockAudio(); // 2. 借机解锁音频
                } else {
                    alert("❌ 你拒绝了通知权限，只能使用网页弹窗提醒");
                }
            });
        } else {
            alert("⚠️ 此浏览器不支持系统通知，将使用网页弹窗");
            this.unlockAudio();
        }
    },

    // 播放一瞬间静音音频，解锁浏览器的 Autoplay 限制
    unlockAudio() {
        this.alarmSound.volume = 0;
        this.alarmSound.play().then(() => {
            this.alarmSound.pause();
            this.alarmSound.currentTime = 0;
            this.alarmSound.volume = 1; // 恢复音量
            this.isAudioUnlocked = true;
            console.log("Audio Unlocked 🔓");
        }).catch(e => console.log("解锁音频失败，需要用户交互", e));
    },

    // 🌟 核心修复：更健壮的提醒逻辑
    checkReminders() {
        const now = new Date();
        
        this.todos.forEach(todo => {
            // 只检查：未完成 + 未提醒 + 有时间 + 开启提醒
            if (todo.status === 'pending' && !todo.notified && todo.time && todo.remindBefore >= 0) {
                
                const targetTime = new Date(todo.time);
                // 计算触发时间
                const triggerTime = new Date(targetTime.getTime() - todo.remindBefore * 60000);
                
                // 宽限期：如果当前时间 已经过了触发时间，但在 30分钟以内（防止浏览器休眠错过了）
                // 且还没有超过目标时间太久
                const gracePeriodEnd = new Date(triggerTime.getTime() + 30 * 60000); 

                if (now >= triggerTime && now <= gracePeriodEnd) {
                    // 1. 触发报警
                    this.triggerAlarm(todo);
                    
                    // 2. 标记为已提醒 (本地 + 云端)
                    todo.notified = true; // 本地立即锁死，防止重复弹窗
                    
                    const query = Bmob.Query(this.tableName);
                    query.get(todo.objectId).then(obj => { 
                        obj.set('notified', true); 
                        obj.save().then(() => console.log("云端已标记提醒"));
                    });
                }
            }
        });
    },

    triggerAlarm(todo) {
        const isAlarm = todo.type === 'alarm';
        const title = isAlarm ? "⏰ 闹钟响了！" : "🔔 备忘提醒";
        const bodyText = todo.remark ? `${todo.text}\n${todo.remark}` : todo.text;

        // A. 播放声音 (尝试循环播放)
        if (isAlarm) {
            this.alarmSound.loop = true;
            this.alarmSound.play().catch(e => console.log("自动播放被拦截，请点击页面", e));
            // 手机震动
            if (navigator.vibrate) navigator.vibrate([1000, 500, 1000, 500]);
        } else {
            // 普通提醒响一声
            this.alarmSound.loop = false;
            this.alarmSound.play().catch(()=>{});
        }

        // B. 系统通知 (如果支持且允许)
        if (Notification.permission === "granted") {
            try {
                new Notification(title, {
                    body: bodyText,
                    icon: 'https://cdn-icons-png.flaticon.com/512/2913/2913520.png',
                    requireInteraction: true // 强制不自动消失
                });
            } catch(e) { console.log(e); }
        }

        // C. 🌟 网页内全屏弹窗 (作为系统通知的兜底，保证一定能看见)
        this.showInAppAlarm(title, bodyText, isAlarm);
    },

    // 网页内全屏弹窗
    showInAppAlarm(title, text, isAlarm) {
        const div = document.createElement('div');
        div.className = 'alarm-overlay';
        div.innerHTML = `
            <div class="alarm-box">
                <div class="alarm-icon">${isAlarm ? '⏰' : '🔔'}</div>
                <div class="alarm-title">${title}</div>
                <div class="alarm-text">${text}</div>
                <button class="alarm-btn" onclick="TodoModule.stopAlarm(this)">${isAlarm ? '关闭闹钟' : '知道了'}</button>
            </div>
        `;
        document.body.appendChild(div);
    },

    stopAlarm(btn) {
        // 停止声音
        this.alarmSound.pause();
        this.alarmSound.currentTime = 0;
        // 移除弹窗
        const overlay = btn.closest('.alarm-overlay');
        if(overlay) overlay.remove();
    },

    render() {
        const container = document.getElementById('todo-list');
        const sorted = this.todos.sort((a,b) => {
            if(a.status === 'pending' && b.status !== 'pending') return -1;
            if(a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(a.time) - new Date(b.time);
        });
        container.innerHTML = sorted.map(t => {
            let icon = '<i class="fas fa-check"></i>';
            let statusClass = '';
            if(t.status === 'done') { icon = '<i class="fas fa-check"></i>'; statusClass = 'checked'; }
            if(t.status === 'failed') { icon = '<i class="fas fa-times"></i>'; statusClass = 'failed'; }
            const timeStr = t.time ? new Date(t.time).toLocaleString([], {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '无时间';
            const typeIcon = t.type === 'alarm' ? '⏰' : '🔔'; 
            let remindText = t.remindBefore === -1 ? '(🔕)' : (t.remindBefore === 0 ? '(⚡准时)' : '');
            const remarkHtml = t.remark ? `<div style="font-size:12px; color:#888; margin-top:2px;">📝 ${t.remark}</div>` : '';
            return `
            <div class="todo-item ${t.status}">
                <div class="todo-left">
                    <div class="checkbox ${statusClass}" onclick="TodoModule.cycleStatus('${t.objectId}', '${t.status}')">
                        ${t.status !== 'pending' ? icon : ''}
                    </div>
                    <div class="todo-content">
                        <strong>${typeIcon} ${t.text} ${remindText}</strong>
                        ${remarkHtml}
                        <small>🕒 ${timeStr}</small>
                    </div>
                </div>
                <div class="todo-actions">
                    <i class="fas fa-trash-alt" onclick="TodoModule.delete('${t.objectId}')"></i>
                </div>
            </div>`;
        }).join('');
    }
};

// ------------------------------------------
// 3. 相册模块 (完全本地化 + 不压缩)
// ------------------------------------------
const AlbumModule = {
    photos: [],
    currentPage: 0,
    itemsPerPage: 4,
    
    init() { this.load(); },

    async load() {
        Loading.show("读取相册...");
        // 从 IndexedDB 读取所有图片
        this.photos = await DBUtils.getAll('album');
        // 按日期倒序
        this.photos.sort((a,b) => new Date(b.date) - new Date(a.date));
        this.render();
        Loading.hide();
    },

    // 导出功能
    async exportData() {
        Loading.show("正在打包导出...");
        const data = await DBUtils.getAll('album');
        FileSync.exportJSON(data, "LoveSpace_Album");
        Loading.hide();
    },

    // 导入功能
    async importData(inputElement) {
        Loading.show("正在导入数据...");
        try {
            const data = await FileSync.importJSON(inputElement);
            if(Array.isArray(data)) {
                for (let item of data) {
                    // 覆盖写入 IndexedDB
                    await DBUtils.save('album', item);
                }
                alert(`成功导入 ${data.length} 张照片！`);
                this.load();
            } else {
                alert("文件格式不正确");
            }
        } catch(e) {
            alert("导入失败: " + e);
        } finally {
            Loading.hide();
            inputElement.value = ''; // 重置 input
        }
    },

    addPhoto() {
        openModal(`
            <h3>📸 添加美好回忆 (本地)</h3>
            <label class="btn full-width" style="text-align:center; display:block; margin-bottom:10px;">
                选择图片 (原图保存)
                <input id="img-file" type="file" accept="image/*" style="display:none" onchange="document.getElementById('file-name').innerText = this.files[0].name">
            </label>
            <p id="file-name" style="font-size:12px; color:#666; text-align:center; margin-bottom:10px;">未选择文件</p>
            <input id="img-date" type="date" value="${new Date().toISOString().split('T')[0]}">
            <input id="img-loc" placeholder="地点">
            <textarea id="img-note" placeholder="写下备注..."></textarea>
            <button class="btn-primary full-width" onclick="AlbumModule.savePhoto()">保存到本地</button>
        `);
    },

    async savePhoto() {
        const fileInput = document.getElementById('img-file');
        const date = document.getElementById('img-date').value;
        const location = document.getElementById('img-loc').value;
        const note = document.getElementById('img-note').value;

        if (!fileInput.files || !fileInput.files[0]) { alert("请选择照片"); return; }
        
        Loading.show("正在保存(大文件可能较慢)...");
        try {
            // ⚠️ 关键点：第二个参数 false 表示不压缩，保留原图
            const base64 = await ImageHandler.process(fileInput.files[0], false);
            
            const newPhoto = {
                id: Date.now().toString(), // 生成唯一ID
                url: base64,
                date: date,
                location: location,
                note: note
            };

            await DBUtils.save('album', newPhoto);
            
            Loading.hide();
            closeModal();
            this.load();
        } catch (e) {
            Loading.hide();
            alert("保存失败: " + e);
        }
    },

    editPhoto(id) {
        // 从 this.photos 查找
        const p = this.photos.find(photo => photo.id === id);
        if(!p) return;
        event.stopPropagation(); // 防止触发 Lightbox
        openModal(`
            <h3>编辑信息</h3>
            <input id="edit-date" type="date" value="${p.date}">
            <input id="edit-loc" value="${p.location}" placeholder="地点">
            <textarea id="edit-note" placeholder="备注">${p.note || ''}</textarea>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button class="btn full-width" style="color:red" onclick="AlbumModule.deletePhoto('${id}')">删除</button>
                <button class="btn-primary full-width" onclick="AlbumModule.updatePhoto('${id}')">保存</button>
            </div>
        `);
    },

    async updatePhoto(id) {
        Loading.show();
        // 先获取旧对象，保留 url，只更新文字
        const oldP = this.photos.find(p => p.id === id);
        if(oldP) {
            oldP.date = document.getElementById('edit-date').value;
            oldP.location = document.getElementById('edit-loc').value;
            oldP.note = document.getElementById('edit-note').value;
            await DBUtils.save('album', oldP);
            closeModal();
            this.load();
        }
    },

    async deletePhoto(id) {
        if(confirm("确定删除这张照片？(本地删除无法恢复)")) {
            Loading.show();
            await DBUtils.delete('album', id);
            closeModal();
            this.load();
        }
    },

    showLightbox(url, note) {
        const lb = document.getElementById('lightbox');
        document.getElementById('lightbox-img').src = url;
        document.getElementById('lightbox-caption').innerText = note || '';
        lb.classList.remove('hidden');
    },

    render() {
        const book = document.getElementById('book');
        const start = this.currentPage * this.itemsPerPage;
        const pagePhotos = this.photos.slice(start, start + this.itemsPerPage);
        const totalPages = Math.ceil(this.photos.length / this.itemsPerPage) || 1;

        let html = '<div class="photo-grid">';
        for(let i=0; i<4; i++) {
            const p = pagePhotos[i];
            if(p) {
                html += `
                <div class="photo-item" onclick="AlbumModule.showLightbox('${p.url}', '${p.note || ''}')">
                    <div class="photo-img-box">
                        <img src="${p.url}">
                    </div>
                    <div class="photo-meta">
                        <span>📅 ${p.date} <br> 📍 ${p.location || '未知'}</span>
                        <i class="fas fa-pen" style="padding:5px;" onclick="AlbumModule.editPhoto('${p.id}')"></i>
                    </div>
                </div>`;
            } else {
                html += `<div class="photo-item" style="opacity:0; pointer-events:none;"></div>`;
            }
        }
        html += '</div>';
        
        book.innerHTML = html;
        document.getElementById('page-indicator').innerText = `第 ${this.currentPage + 1} 页 / 共 ${totalPages} 页`;
    },

    nextPage() {
        const totalPages = Math.ceil(this.photos.length / this.itemsPerPage) || 1;
        if (this.currentPage < totalPages - 1) { this.currentPage++; this.render(); }
    },
    prevPage() {
        if (this.currentPage > 0) { this.currentPage--; this.render(); }
    }
};

// ------------------------------------------
// 4. 纪念日模块 (Bmob)
// ------------------------------------------
const AnniversaryModule = {
    events: [],
    tableName: 'Love_Anniversary',
    init() { this.load(); },
    load() {
        const query = Bmob.Query(this.tableName);
        query.find().then(res => { this.events = res; this.render(); });
    },
    add() {
        const name = document.getElementById('anni-name').value;
        const date = document.getElementById('anni-date').value;
        if(name && date) {
            Loading.show();
            const query = Bmob.Query(this.tableName);
            query.set("name", name);
            query.set("startDate", date);
            query.save().then(() => { this.load(); Loading.hide(); document.getElementById('anni-name').value = ''; });
        }
    },
    delete(objectId) {
        if(confirm("删除此纪念日？")) {
            Loading.show();
            const query = Bmob.Query(this.tableName);
            query.destroy(objectId).then(() => this.load());
        }
    },
    render() {
        const list = document.getElementById('anni-list');
        const today = new Date();
        today.setHours(0,0,0,0);
        const computedEvents = this.events.map(e => {
            const start = new Date(e.startDate);
            let nextDate = new Date(start);
            nextDate.setFullYear(today.getFullYear());
            if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
            const diffTime = nextDate - today;
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const nth = nextDate.getFullYear() - start.getFullYear();
            return { ...e, daysLeft, nth, nextDate };
        });
        computedEvents.sort((a,b) => a.daysLeft - b.daysLeft);
        list.innerHTML = computedEvents.map(e => `
            <li>
                <div style="flex:1">
                    <div style="display:flex; align-items:baseline;">
                        <span class="anni-highlight">${e.daysLeft === 0 ? '今天!' : e.daysLeft + '天'}</span>
                        <span>后是 ${e.name}</span>
                    </div>
                    <div class="anni-desc">
                        目标日：${e.nextDate.toLocaleDateString()} (${e.nth}周年) <br>
                        起始日：${e.startDate}
                    </div>
                </div>
                <button class="delete-btn" onclick="AnniversaryModule.delete('${e.objectId}')">&times;</button>
            </li>
        `).join('');
    }
};

// ------------------------------------------
// 5. 厨房模块 (本地化 + 压缩图片)
// ------------------------------------------
const KitchenModule = {
    recipes: [],
    categories: ['全部', '家常菜', '甜点', '大餐'], 
    currentCat: '全部',
    
    init() { this.renderCategories(); this.load(); },

    async load() {
        Loading.show("读取菜谱...");
        this.recipes = await DBUtils.getAll('kitchen');
        this.renderRecipes();
        Loading.hide();
    },

    async exportData() {
        Loading.show("导出中...");
        const data = await DBUtils.getAll('kitchen');
        FileSync.exportJSON(data, "LoveSpace_Kitchen");
        Loading.hide();
    },

    async importData(inputElement) {
        Loading.show("导入中...");
        try {
            const data = await FileSync.importJSON(inputElement);
            if(Array.isArray(data)) {
                for(let item of data) {
                    await DBUtils.save('kitchen', item);
                }
                alert(`成功导入 ${data.length} 个菜谱！`);
                this.load();
            }
        } catch(e) {
            alert("导入失败: " + e);
        } finally {
            Loading.hide();
            inputElement.value = '';
        }
    },

    renderCategories() {
        document.getElementById('category-list-container').innerHTML = this.categories.map(cat => `
            <button class="category-tag ${this.currentCat === cat ? 'active' : ''}" onclick="KitchenModule.filter('${cat}')">${cat}</button>
        `).join('');
    },
    filter(cat) { this.currentCat = cat; this.renderCategories(); this.renderRecipes(); },
    
    addRecipe() {
        const catOptions = this.categories.filter(c => c !== '全部').map(c => `<option>${c}</option>`).join('');
        openModal(`
            <h3>🍴 新建菜谱 (本地)</h3>
            <input id="r-name" placeholder="菜名">
            <select id="r-cat">${catOptions}</select>
            <label class="btn full-width" style="text-align:center; display:block; margin-top:5px;">
                上传成品图 (自动压缩)
                <input id="r-file" type="file" accept="image/*" style="display:none" onchange="document.getElementById('r-file-name').innerText = this.files[0].name">
            </label>
            <p id="r-file-name" style="font-size:12px; color:#666; text-align:center;">未选择文件</p>
            <textarea id="r-mat" placeholder="所需材料..." rows="3"></textarea>
            <textarea id="r-step" placeholder="做法步骤..." rows="5"></textarea>
            <button class="btn-primary full-width" onclick="KitchenModule.save()">保存</button>
        `);
    },

    async save() {
        const fileInput = document.getElementById('r-file');
        // 默认图
        let imgUrl = 'https://source.unsplash.com/random/200x200?food';
        
        Loading.show("正在保存...");
        try {
            if (fileInput.files && fileInput.files[0]) {
                // ⚠️ 关键点：第二个参数 true，表示启用 Canvas 压缩
                // 这样导出文件时体积会小很多，方便微信传输
                imgUrl = await ImageHandler.process(fileInput.files[0], true);
            }
            
            const newRecipe = {
                id: Date.now().toString(),
                name: document.getElementById('r-name').value,
                category: document.getElementById('r-cat').value,
                materials: document.getElementById('r-mat').value,
                steps: document.getElementById('r-step').value,
                image: imgUrl
            };
            
            await DBUtils.save('kitchen', newRecipe);
            
            Loading.hide();
            closeModal();
            this.load();
        } catch(e) {
            Loading.hide();
            alert("保存失败: " + e);
        }
    },

    async deleteRecipe(id) {
        if(confirm("删除？(本地删除不可恢复)")) {
            Loading.show();
            await DBUtils.delete('kitchen', id);
            this.load();
        }
    },

    renderRecipes() {
        const list = this.currentCat === '全部' ? this.recipes : this.recipes.filter(r => r.category === this.currentCat);
        document.getElementById('recipe-list').innerHTML = list.map(r => `
            <div class="recipe-card">
                <img src="${r.image}" onclick="alert('材料：\\n${r.materials}\\n\\n做法：\\n${r.steps}')">
                <div class="recipe-info">
                    <h4>${r.name}</h4>
                    <p style="color:#999; font-size:12px;">${r.category}</p>
                    <div class="recipe-actions"><i class="fas fa-trash-alt action-icon" onclick="KitchenModule.deleteRecipe('${r.id}')"></i></div>
                </div>
            </div>
        `).join('');
    }
};

// ------------------------------------------
// 6. 健康模块 (Bmob)
// ------------------------------------------
const HealthModule = {
    weights: [],
    chart: null,
    periodSettings: { lastDate: '', duration: 5, cycle: 28, objectId: null }, 
    init() { this.load(); this.initChart(); },
    load() {
        const q1 = Bmob.Query("Love_Period");
        q1.find().then(res => {
            if(res.length > 0) {
                const s = res[0];
                this.periodSettings = { lastDate: s.lastDate, duration: s.duration, cycle: s.cycle, objectId: s.objectId };
                document.getElementById('last-period-date').value = s.lastDate;
                document.getElementById('period-duration').value = s.duration;
                document.getElementById('cycle-length').value = s.cycle;
                this.renderPeriod();
            }
        });
        const q2 = Bmob.Query("Love_Weight");
        q2.order("date");
        q2.find().then(res => { this.weights = res; this.updateChart(); });
    },
    savePeriod() {
        const lastDate = document.getElementById('last-period-date').value;
        const duration = parseInt(document.getElementById('period-duration').value);
        const cycle = parseInt(document.getElementById('cycle-length').value);
        Loading.show();
        const query = Bmob.Query("Love_Period");
        if (this.periodSettings.objectId) {
            query.get(this.periodSettings.objectId).then(obj => {
                obj.set("lastDate", lastDate);
                obj.set("duration", duration);
                obj.set("cycle", cycle);
                obj.save().then(() => { Loading.hide(); this.load(); });
            });
        } else {
            query.set("lastDate", lastDate);
            query.set("duration", duration);
            query.set("cycle", cycle);
            query.save().then(() => { Loading.hide(); this.load(); });
        }
    },
    renderPeriod() {
        const lastDateStr = this.periodSettings.lastDate;
        if (!lastDateStr) return;
        const lastDate = new Date(lastDateStr);
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';
        const today = new Date(); today.setHours(0,0,0,0);
        const cycle = this.periodSettings.cycle;
        const duration = this.periodSettings.duration;
        for (let i = 0; i < 35; i++) {
            const currentDay = new Date(lastDate);
            currentDay.setDate(lastDate.getDate() + i);
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            cell.innerText = currentDay.getDate();
            if(currentDay.getTime() === today.getTime()) cell.classList.add('today');
            const dayOfCycle = Math.floor((currentDay - lastDate) / (1000 * 60 * 60 * 24)) % cycle;
            if (dayOfCycle >= 0 && dayOfCycle < duration) cell.classList.add('period');
            else if (dayOfCycle === cycle - 14) cell.classList.add('ovulation');
            grid.appendChild(cell);
        }
    },
    addWeight() {
        const val = document.getElementById('weight-val').value;
        const dateVal = document.getElementById('weight-date').value;
        if (val && dateVal) {
            Loading.show();
            const query = Bmob.Query("Love_Weight");
            query.set("date", dateVal);
            query.set("value", val);
            query.save().then(() => { Loading.hide(); alert("已记录"); });
        }
    },
    initChart() {
        const ctx = document.getElementById('weightChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{ label: '体重 (kg)', data: [], borderColor: '#ff7b9c', backgroundColor: 'rgba(255, 123, 156, 0.1)', tension: 0.3, fill: true }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
        });
    },
    updateChart() {
        this.weights.sort((a,b) => new Date(a.date) - new Date(b.date));
        const data = this.weights.slice(-30);
        this.chart.data.labels = data.map(w => w.date.slice(5));
        this.chart.data.datasets[0].data = data.map(w => w.value);
        this.chart.update();
    }
};

// 通用模态框
function openModal(html) { document.getElementById('modal-body').innerHTML = html; document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });