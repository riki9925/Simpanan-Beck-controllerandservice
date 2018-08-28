import db from "./../lib/db";
import moment from "moment";
import { multipleInsert } from "./../lib/util";

/**
 * Mengambil semua agama dari database
 */
Number.prototype.pad = function(size) {
  let s = String(this);
  while (s.length < (size || 2)) {
    s = "0" + s;
  }
  return s;
};
Number.prototype.add = function(size) {
  return this + size;
};
const update_simpanan = (params, pendukung, simp) => {
  return new Promise((resolve, reject) => {
    try {
      db.query(
        "UPDATE mastersimp SET kredit = ?,debet = ? , saldo = ? where NOSIMP = ? AND KU = ? AND CIF = ?",
        [
          simp.KREDIT,
          simp.DEBET,
          simp.SALDO,
          simp.NOSIMP,
          params.KU,
          params.CIF
        ],
        (err, result) => {
          if (err) {
            reject("update transaksi gagal");
          }
          let payload = {
            transsimp: {
              TANGGAL: moment(new Date()).format(),
              NTRANS: pendukung.NTRANS,
              NOSIMP: simp.NOSIMP,
              TGLSETOR: moment(new Date()).format(),
              KETERANGAN: params.KETERANGAN || "-",
              BERITA: params.BERITA || "-",
              DEBET: pendukung.PENGURANGAN ? simp.NOMINAL.toFixed(2) : 0,
              KREDIT: pendukung.PENGURANGAN ? 0 : simp.NOMINAL.toFixed(2),
              ST: 2,
              SALDO: simp.SALDO.toFixed(2),
              UID: params.UID,
              KU: params.KU,
              CIF: params.CIF
            },
            transaksi: {
              NTRANS: pendukung.NTRANS,
              KTRANS: pendukung.KTRANS,
              KBT: params.KBT,
              NBT: pendukung.NTRANS,
              BT:
                params.KBT +
                "/" +
                moment(new Date()).format("MM") +
                "/" +
                pendukung.NTRANS,
              TANGGAL: moment(new Date()).format(),
              ACC: pendukung.ACC_SIMPANAN.ACC,
              KETACC: pendukung.ACC_SIMPANAN.KETERANGAN,
              KETERANGAN: params.KETERANGAN,
              DEBET: pendukung.PENGURANGAN ? 0 : simp.NOMINAL.toFixed(2),
              KREDIT: pendukung.PENGURANGAN ? simp.NOMINAL.toFixed(2) : 0,
              ST: 2,
              PRT: 0,
              UID: params.UID,
              KU: params.KU,
              CIF: params.CIF,
              UID_APV: params.UID
            }
          };
          resolve(payload);
        }
      );
    } catch (err) {
      console.log(err);
    }
  });
};
const findAllSimpanan = cif => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM v_mastersimp where CIF = ?",
      [cif],
      (err, result) => {
        if (err) {
          reject(err.message);
        }
        resolve(result);
      }
    );
  });
};

/**
 * Membuat agama baru
 */
const cariSimpanan = param => {
  return new Promise((resolve, reject) => {
    db.query(
      "select * from v_mastersimp where NOSIMP = ? and KU = ? AND CIF = ? ",
      [param.NOSIMP, param.KU, param.CIF],
      function(err, result, fields) {
        if (err) {
          reject(err);
        }
        resolve(result[0]);
      }
    );
  });
};

const setoran_pokok = param => {
  return new Promise((resolve, reject) => {
    cariSimpanan(param)
      .then(data => {
        db.beginTransaction(err => {
          if (err) {
            return db.rollback(() => {
              reject(err);
            });
          }
          db.query(
            "UPDATE mastersimp SET kredit = ? , saldo = ? where NOSIMP = ? AND KU = ? AND CIF = ?",
            [
              data.KREDIT + param.NOMINAL,
              data.SALDO + param.NOMINAL,
              param.NOSIMP,
              param.KU,
              param.CIF
            ],
            (err, result) => {
              if (err) {
                return db.rollback(() => {
                  reject(err);
                });
              }
              let query =
                "SELECT max(NBT) as NBT from transaksi WHERE cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;";
              db.query(
                query,
                [
                  param.CIF,
                  data.ACC,
                  param.KU,
                  param.CIF,
                  param.ACC,
                  param.KU,
                  param.CIF
                ],
                (err, result) => {
                  const NBT = !result[0][0].NBT ? 0 : result[0][0].NBT;
                  const ACC_SIMPANAN = result[1][0];
                  const ACC_KAS_BANK = result[2][0];
                  const NTRANS = parseInt(NBT)
                    .add(1)
                    .pad(7);
                  let transimp = {
                    TANGGAL: moment(new Date()).format(),
                    NTRANS: NTRANS,
                    NOSIMP: data.NOSIMP,
                    TGLSETOR: moment(new Date()).format(),
                    KETERANGAN: param.KETERANGAN || "-",
                    BERITA: param.BERITA || "-",
                    DEBET: 0,
                    KREDIT: param.NOMINAL,
                    ST: 2,
                    SALDO: data.SALDO + param.NOMINAL,
                    UID: param.UID,
                    KU: param.KU,
                    CIF: param.CIF
                  };
                  db.query("INSERT INTO transsimp set ? ", transimp, function(
                    err,
                    result,
                    fields
                  ) {
                    if (err) {
                      return db.rollback(() => {
                        reject(err);
                      });
                    }
                  });
                  let transaksi = [
                    {
                      NTRANS: NTRANS,
                      KTRANS: "1011",
                      KBT: param.KBT,
                      NBT: NTRANS,
                      BT:
                        param.KBT +
                        "/" +
                        moment(new Date()).format("MM") +
                        "/" +
                        NTRANS,
                      TANGGAL: moment(new Date()).format(),
                      ACC: ACC_SIMPANAN.ACC,
                      KETACC: ACC_SIMPANAN.KETERANGAN,
                      KETERANGAN: param.KETERANGAN,
                      DEBET: 0,
                      KREDIT: param.NOMINAL,
                      ST: 2,
                      PRT: 0,
                      UID: param.UID,
                      KU: param.KU,
                      CIF: param.CIF,
                      UID_APV: param.UID
                    },
                    {
                      NTRANS: NTRANS,
                      KTRANS: "1011",
                      KBT: param.KBT,
                      NBT: NTRANS,
                      BT:
                        param.KBT +
                        "/" +
                        moment(new Date()).format("MM") +
                        "/" +
                        NTRANS,
                      TANGGAL: moment(new Date()).format(),
                      ACC: ACC_KAS_BANK.ACC,
                      KETACC: ACC_KAS_BANK.KETERANGAN,
                      KETERANGAN: param.KETERANGAN,
                      DEBET: param.NOMINAL,
                      KREDIT: 0,
                      ST: 2,
                      PRT: 0,
                      UID: param.UID,
                      KU: param.KU,
                      CIF: param.CIF,
                      UID_APV: param.UID
                    }
                  ];
                  multipleInsert(db, "transaksi", transaksi, (err, result) => {
                    if (err) {
                      return db.rollback(() => {
                        reject(err);
                      });
                    }
                    db.commit(function(err) {
                      if (err) {
                        return db.rollback(() => {
                          reject(err);
                        });
                      }

                      resolve({
                        message: "suksess"
                      });
                    });
                  });
                }
              );
            }
          );
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

const setoran_per_anggota = param => {
  return new Promise((resolve, reject) => {
    if (param.transaksi.filter(x => parseInt(x.NOMINAL) > 0).length <= 0) {
      reject("Tidak ada transaksi yang di proses!");
    }
    var transaction;
    let NBT;
    let ACC_SIMPANAN;
    let ACC_KAS_BANK;
    let NTRANS;
    db.beginTransaction(err => {
      if (err) {
        return db.rollback(() => {
          reject("Transaksi gagal");
        });
      }
      let queue = [];
      let transimp = [];
      let transaction = [];
      param.transaksi.forEach(e => {
        let antrian = new Promise((resolve, reject) => {
          cariSimpanan({ NOSIMP: e.NOSIMP, KU: param.KU, CIF: param.CIF })
            .then(data => {
              if (err) {
                return db.rollback(() => {
                  reject("Transaksi simpanan gagal");
                });
              }
              db.query(
                "UPDATE mastersimp SET kredit = ? , saldo = ? where NOSIMP = ? AND KU = ? AND CIF = ?",
                [
                  data.KREDIT + parseFloat(e.NOMINAL),
                  data.SALDO + parseFloat(e.NOMINAL),
                  e.NOSIMP,
                  param.KU,
                  param.CIF
                ],
                (err, result) => {
                  if (err) {
                    return db.rollback(() => {
                      reject("Transaksi simpanan gagal");
                    });
                  }
                  let query =
                    "SELECT max(NBT) as NBT from transaksi WHERE cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;";
                  db.query(
                    query,
                    [
                      param.CIF,
                      data.ACC,
                      param.KU,
                      param.CIF,
                      param.ACC,
                      param.KU,
                      param.CIF
                    ],
                    (err, result) => {
                      console.log(result);
                      NBT = !result[0][0].NBT ? 0 : result[0][0].NBT;
                      ACC_SIMPANAN = result[1][0];
                      ACC_KAS_BANK = result[2][0];
                      NTRANS = parseInt(NBT)
                        .add(1)
                        .pad(7);
                      transimp.push({
                        TANGGAL: moment(new Date()).format(),
                        NTRANS: NTRANS,
                        NOSIMP: data.NOSIMP,
                        TGLSETOR: moment(new Date()).format(),
                        KETERANGAN: param.KETERANGAN || "-",
                        BERITA: param.BERITA || "-",
                        DEBET: 0,
                        KREDIT: e.NOMINAL,
                        ST: 2,
                        SALDO: data.SALDO + parseFloat(e.NOMINAL),
                        UID: param.UID,
                        KU: param.KU,
                        CIF: param.CIF
                      });
                      transaction.push({
                        NTRANS: NTRANS,
                        KTRANS: "1011",
                        KBT: param.KBT,
                        NBT: NTRANS,
                        BT:
                          param.KBT +
                          "/" +
                          moment(new Date()).format("MM") +
                          "/" +
                          NTRANS,
                        TANGGAL: moment(new Date()).format(),
                        ACC: ACC_SIMPANAN.ACC,
                        KETACC: ACC_SIMPANAN.KETERANGAN,
                        KETERANGAN: param.KETERANGAN,
                        DEBET: 0,
                        KREDIT: parseFloat(e.NOMINAL),
                        ST: 2,
                        PRT: 0,
                        UID: param.UID,
                        KU: param.KU,
                        CIF: param.CIF,
                        UID_APV: param.UID
                      });
                      resolve("done");
                    }
                  );
                }
              );
            })
            .catch(err => {
              return db.rollback(() => {
                reject("Transaksi simpanan gagal");
              });
            });
        });
        queue.push(antrian);
      });
      Promise.all(queue)
        .then(data => {
          transaction.push({
            NTRANS: NTRANS,
            KTRANS: "1011",
            KBT: param.KBT,
            NBT: NTRANS,
            BT:
              param.KBT + "/" + moment(new Date()).format("MM") + "/" + NTRANS,
            TANGGAL: moment(new Date()).format(),
            ACC: ACC_KAS_BANK.ACC,
            KETACC: ACC_KAS_BANK.KETERANGAN,
            KETERANGAN: param.KETERANGAN,
            DEBET: parseFloat(param.NOMINAL),
            KREDIT: 0,
            ST: 2,
            PRT: 0,
            UID: param.UID,
            KU: param.KU,
            CIF: param.CIF,
            UID_APV: param.UID
          });
          multipleInsert(db, "transsimp", transimp, (err, result) => {
            if (err) {
              return db.rollback(() => {
                reject("Transaksi simpanan gagal");
              });
            }
            multipleInsert(db, "transaksi", transaction, (err, result) => {
              if (err) {
                return db.rollback(() => {
                  reject("Transaksi simpanan gagal");
                });
              }
              db.commit(function(err) {
                if (err) {
                  return db.rollback(() => {
                    reject("Transaksi simpanan gagal");
                  });
                }
                resolve(transaction);
              });
            });
          });
        })
        .catch(err => {
          return db.rollback(() => {
            reject("Transaksi simpanan gagal");
          });
        });
    });
  });
};

const pindah_buku = param => {};

const pendebetan_biaya_admin = param => {
  return new Promise((resolve, reject) => {
    const queue = [];
    let pendukung = {};
    db.query(
      "select * from v_jenissimp where ACC = ? and KU = ? AND CIF = ? limit 1",
      [param.ACC, param.KU, param.CIF],
      (err, result) => {
        const jenissimp = result[0];
        if (!jenissimp) {
          reject("Jenis simpanan tidak di temukan");
        }
        if (jenissimp.ADM <= 0) {
          reject("Jenis simpanan tidak memiliki admin");
        }
        db.beginTransaction(err => {
          if (err) {
            return db.rollback(() => {
              reject("Transaksi gagal");
            });
          }
          db.query(
            "select NOSIMP,SALDO, KREDIT ,DEBET from v_mastersimp where ACC = ? AND KU = ? AND CIF = ? ",
            [param.ACC, param.KU, param.CIF],
            (err, result) => {
              if (result.length <= 0) {
                reject("tidak ada simpanan");
              }
              let listmastersimp = result;
              let query =
                "SELECT max(NBT) as NBT from transaksi WHERE cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;";
              db.query(
                query,
                [
                  param.CIF,
                  jenissimp.ACCADM,
                  param.KU,
                  param.CIF,
                  param.ACC,
                  param.KU,
                  param.CIF
                ],
                (err, result) => {
                  if (result.length <= 0) {
                    return db.rollback(() => {
                      reject("Transaksi gagal");
                    });
                  }
                  let NBT = !result[0][0].NBT ? 0 : result[0][0].NBT;
                  NBT = parseInt(NBT)
                  .add(1)
                  .pad(7);
                  pendukung = {
                    PENGURANGAN: true,
                    NBT: NBT,
                    ACC_SIMPANAN: result[1][0],
                    ACC_KAS_BANK: result[2][0],
                    KTRANS: "1113",
                    NTRANS: NBT
                  };
                  let total = 0;
                  listmastersimp
                    .map(e => {
                      e.NOMINAL = jenissimp.ADM;
                      e.SALDO = e.SALDO + jenissimp.ADM;
                      e.DEBET = e.DEBET + jenissimp.ADM;
                      total = total + jenissimp.ADM;
                      return e;
                    })
                    .forEach(e => {
                      queue.push(update_simpanan(param, pendukung, e));
                    });
                  Promise.all(queue)
                    .then(data => {
                      let transimp = data.map(e => e.transsimp);
                      let transaksi = data.map(e => e.transaksi);
                      transaksi.push({
                        NTRANS: pendukung.NTRANS,
                        KTRANS: pendukung.KTRANS,
                        KBT: param.KBT,
                        NBT: pendukung.NBT,
                        BT:
                          param.KBT +
                          "/" +
                          moment(new Date()).format("MM") +
                          "/" +
                          pendukung.NTRANS,
                        TANGGAL: moment(new Date()).format(),
                        ACC: pendukung.ACC_KAS_BANK.ACC,
                        KETACC: pendukung.ACC_KAS_BANK.KETERANGAN,
                        KETERANGAN: param.KETERANGAN,
                        DEBET: total.toFixed(2),
                        KREDIT: 0,
                        ST: 2,
                        PRT: 0,
                        UID: param.UID,
                        KU: param.KU,
                        CIF: param.CIF,
                        UID_APV: param.UID
                      });
                      multipleInsert(
                        db,
                        "transsimp",
                        transimp,
                        (err, result) => {
                          if (err) {
                            return db.rollback(() => {
                              reject("Transaksi gagal transimp");
                            });
                          }
                          multipleInsert(
                            db,
                            "transaksi",
                            transaksi,
                            (err, result) => {
                              if (err) {
                                return db.rollback(() => {
                                  reject("Transaksi gagal transaksi");
                                });
                              }
                              resolve({
                                transimp: transimp,
                                transaksi: transaksi
                              });
                            }
                          );
                        }
                      );
                    })
                    .catch(err => {
                      if (err) {
                        console.log(err);
                        return db.rollback(() => {
                          reject("Transaksi gagal on promise all");
                        });
                      }
                    });
                }
              );
            }
          );
        });
      }
    );
  });
};

const pengkreditan_bunga_jasa = param => {
  return new Promise((resolve, reject) => {
    try {
      const queue = [];
      let pendukung;
      db.query(
        "select * from v_jenissimp where ACC = ? and KU = ? AND CIF = ? limit 1",
        [param.ACC, param.KU, param.CIF],
        (err, result) => {
          let jenissimp = result[0];
          if (!jenissimp && jenissimp.BGA <= 0) {
            reject("Jenis simpanan tidak di temukan");
          } else {
            db.beginTransaction(err => {
              if (err) {
                return db.rollback(() => {
                  reject("Transaksi gagal");
                });
              }
              db.query(
                "select NOSIMP,SALDO, KREDIT,DEBET from v_mastersimp where ACC = ? AND KU = ? AND CIF = ? ",
                [param.ACC, param.KU, param.CIF],
                (err, result) => {
                  if (result.length <= 0) {
                    reject("tidak ada simpanan");
                  }
                  let listmastersimp = result;
                  let query =
                    "SELECT max(NBT) as NBT from transaksi WHERE cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;";
                  db.query(
                    query,
                    [
                      param.CIF,
                      jenissimp.ACCBGA,
                      param.KU,
                      param.CIF,
                      param.ACC,
                      param.KU,
                      param.CIF
                    ],
                    (err, result) => {
                      if (result.length <= 0) {
                        return db.rollback(() => {
                          reject("Transaksi gagal");
                        });
                      }
                      let NBT = !result[0][0].NBT ? 0 : result[0][0].NBT;
                      NBT =  parseInt(NBT)
                      .add(1)
                      .pad(7);
                      pendukung = {
                        PENGURANGAN: false,
                        NBT: NBT,
                        ACC_SIMPANAN: result[1][0],
                        ACC_KAS_BANK: result[2][0],
                        KTRANS: "1113",
                        NTRANS: NBT
                      };
                      let total = 0;
                      listmastersimp
                        .map(e => {
                          let nominal_bunga =
                            parseFloat(e.SALDO) * (jenissimp.BGA / 100) / 12;
                            e.NOMINAL = nominal_bunga;
                            e.SALDO = parseFloat(e.SALDO) + nominal_bunga;
                            e.KREDIT = parseFloat(e.KREDIT) + nominal_bunga;
                          total = total + nominal_bunga;
                          return e;
                        })
                        .forEach(e => {
                          queue.push(update_simpanan(param, pendukung, e));
                        });
                      Promise.all(queue)
                        .then(data => {
                          let transimp = data.map(e => e.transsimp);
                          let transaksi = data.map(e => e.transaksi);
                          transaksi.push({
                            NTRANS: pendukung.NTRANS,
                            KTRANS: pendukung.KTRANS,
                            KBT: param.KBT,
                            NBT: pendukung.NBT,
                            BT:
                              param.KBT +
                              "/" +
                              moment(new Date()).format("MM") +
                              "/" +
                              pendukung.NTRANS,
                            TANGGAL: moment(new Date()).format(),
                            ACC: pendukung.ACC_KAS_BANK.ACC,
                            KETACC: pendukung.ACC_KAS_BANK.KETERANGAN,
                            KETERANGAN: param.KETERANGAN,
                            DEBET: 0,
                            KREDIT: total.toFixed(2),
                            ST: 2,
                            PRT: 0,
                            UID: param.UID,
                            KU: param.KU,
                            CIF: param.CIF,
                            UID_APV: param.UID
                          });
                          multipleInsert(
                            db,
                            "transsimp",
                            transimp,
                            (err, result) => {
                              if (err) {
                                return db.rollback(() => {
                                  reject("Transaksi gagal");
                                });
                              }
                              multipleInsert(
                                db,
                                "transaksi",
                                transaksi,
                                (err, result) => {
                                  if (err) {
                                    return db.rollback(() => {
                                      reject("Transaksi gagal");
                                    });
                                  }
                                  resolve({
                                    transimp: transimp,
                                    transaksi: transaksi
                                  });
                                }
                              );
                            }
                          );
                        })
                        .catch(err => {
                          if (err) {
                            return db.rollback(() => {
                              reject("Transaksi gagal");
                            });
                          }
                        });
                    }
                  );
                }
              );
            });
          }
        }
      );
    } catch (err) {
      console.log(err);
    }
  });
};

const pengkreditan_simpanan = param => {
  return new Promise((resolve, reject) => {
    if (param.transaksi.filter(x => parseInt(x.NOMINAL) > 0).length <= 0) {
      reject("Tidak ada transaksi yang di proses!");
    }
    var transaction = [];
    let NBT;
    let ACC_SIMPANAN;
    let ACC_KAS_BANK;
    let NTRANS;
    let transimp = [];
    db.beginTransaction(err => {
      if (err) {
        return db.rollback(() => {
          reject("Transaksi pengkreditan simpanan  gagal");
        });
      }
      let queue = [];
      param.transaksi.forEach(e => {
        let antrian = new Promise((resolve, reject) => {
          cariSimpanan({ NOSIMP: e.NOSIMP, KU: param.KU, CIF: param.CIF })
            .then(data => {
              db.query(
                "UPDATE mastersimp SET kredit = ? , saldo = ? where NOSIMP = ? AND KU = ? AND CIF = ?",
                [
                  data.KREDIT + parseFloat(e.NOMINAL),
                  data.SALDO + parseFloat(e.NOMINAL),
                  e.NOSIMP,
                  param.KU,
                  param.CIF
                ],
                (err, result) => {
                  if (err) {
                    return db.rollback(() => {
                      reject("Transaksi pengkreditan simpanan gagal");
                    });
                  }
                  let query =
                    "SELECT max(NBT) as NBT from transaksi WHERE cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;";
                  db.query(
                    query,
                    [
                      param.CIF,
                      data.ACC,
                      param.KU,
                      param.CIF,
                      param.ACC,
                      param.KU,
                      param.CIF
                    ],
                    (err, result) => {
                      NBT = !result[0][0].NBT ? 0 : result[0][0].NBT;
                      ACC_SIMPANAN = result[1][0];
                      ACC_KAS_BANK = result[2][0];
                      NTRANS = parseInt(NBT)
                        .add(1)
                        .pad(7);
                      transimp.push({
                        TANGGAL: moment(new Date()).format(),
                        NTRANS: NTRANS,
                        NOSIMP: data.NOSIMP,
                        TGLSETOR: moment(new Date()).format(),
                        KETERANGAN: param.KETERANGAN || "-",
                        BERITA: param.BERITA || "-",
                        DEBET: 0,
                        KREDIT: e.NOMINAL,
                        ST: 2,
                        SALDO: data.SALDO + parseFloat(e.NOMINAL),
                        UID: param.UID,
                        KU: param.KU,
                        CIF: param.CIF
                      });
                      transaction.push({
                        NTRANS: NTRANS,
                        KTRANS: "1111",
                        KBT: param.KBT,
                        NBT: NTRANS,
                        BT:
                          param.KBT +
                          "/" +
                          moment(new Date()).format("MM") +
                          "/" +
                          NTRANS,
                        TANGGAL: moment(new Date()).format(),
                        ACC: ACC_SIMPANAN.ACC,
                        KETACC: ACC_SIMPANAN.KETERANGAN,
                        KETERANGAN: param.KETERANGAN,
                        DEBET: 0,
                        KREDIT: parseFloat(e.NOMINAL),
                        ST: 2,
                        PRT: 0,
                        UID: param.UID,
                        KU: param.KU,
                        CIF: param.CIF,
                        UID_APV: param.UID
                      });
                      resolve("oke");
                    }
                  );
                }
              );
            })
            .catch(err => {
              return db.rollback(() => {
                reject("Transaksi pengkreditan simpanan gagal");
              });
            });
        });
        queue.push(antrian);
      });
      Promise.all(queue)
        .then(data => {
          transaction.push({
            NTRANS: NTRANS,
            KTRANS: "1111",
            KBT: param.KBT,
            NBT: NTRANS,
            BT:
              param.KBT + "/" + moment(new Date()).format("MM") + "/" + NTRANS,
            TANGGAL: moment(new Date()).format(),
            ACC: ACC_KAS_BANK.ACC,
            KETACC: ACC_KAS_BANK.KETERANGAN,
            KETERANGAN: param.KETERANGAN,
            DEBET: parseFloat(param.NOMINAL),
            KREDIT: 0,
            ST: 2,
            PRT: 0,
            UID: param.UID,
            KU: param.KU,
            CIF: param.CIF,
            UID_APV: param.UID
          });
          multipleInsert(db, "transsimp", transimp, (err, result) => {
            if (err) {
              return db.rollback(() => {
                reject("Transaksi pengkreditan simpanan gagal");
              });
            }
            multipleInsert(db, "transaksi", transaction, (err, result) => {
              if (err) {
                return db.rollback(() => {
                  reject("Transaksi pengkreditan simpanan gagal");
                });
              }
              db.commit(function(err) {
                if (err) {
                  return db.rollback(() => {
                    reject(err);
                  });
                }
                resolve(transaction);
              });
            });
          });
        })
        .catch(err => {
          reject("Transaksi pengkreditan simpanan gagal");
        });
    });
  });
};

const penarikan_simpanan = param => {
  return new Promise((resolve, reject) => {
    if (param.transaksi.filter(x => parseInt(x.NOMINAL) > 0).length <= 0) {
      reject("Tidak ada transaksi yang di proses!");
    }
    var transaction;
    let NBT;
    let ACC_SIMPANAN;
    let ACC_KAS_BANK;
    let NTRANS;
    db.beginTransaction(err => {
      let queue = [];
      param.transaksi.forEach(e => {
        let antrian = new Promise((resolve, reject) => {
          cariSimpanan({ NOSIMP: e.NOSIMP, KU: param.KU, CIF: param.CIF })
            .then(data => {
              if (err) {
                return db.rollback(() => {
                  reject("Transaksi penarikan simpanan  gagal");
                });
              }
              db.query(
                "UPDATE mastersimp SET kredit = ? , saldo = ? where NOSIMP = ? AND KU = ? AND CIF = ?",
                [
                  data.KREDIT - parseFloat(e.NOMINAL),
                  data.SALDO - parseFloat(e.NOMINAL),
                  e.NOSIMP,
                  param.KU,
                  param.CIF
                ],
                (err, result) => {
                  if (err) {
                    return db.rollback(() => {
                      reject("Transaksi penarikan simpanan gagal");
                    });
                  }
                  let query =
                    "SELECT max(NBT) as NBT from transaksi WHERE cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;";
                  db.query(
                    query,
                    [
                      param.CIF,
                      data.ACC,
                      param.KU,
                      param.CIF,
                      param.ACC,
                      param.KU,
                      param.CIF
                    ],
                    (err, result) => {
                      NBT = !result[0][0].NBT ? 0 : result[0][0].NBT;
                      ACC_SIMPANAN = result[1][0];
                      ACC_KAS_BANK = result[2][0];
                      NTRANS = parseInt(NBT)
                        .add(1)
                        .pad(7);
                      let transimp = {
                        TANGGAL: moment(new Date()).format(),
                        NTRANS: NTRANS,
                        NOSIMP: data.NOSIMP,
                        TGLSETOR: moment(new Date()).format(),
                        KETERANGAN: param.KETERANGAN || "-",
                        BERITA: param.BERITA || "-",
                        DEBET: 0,
                        KREDIT: e.NOMINAL,
                        ST: 2,
                        SALDO: data.SALDO - parseFloat(e.NOMINAL),
                        UID: param.UID,
                        KU: param.KU,
                        CIF: param.CIF
                      };
                      db.query(
                        "INSERT INTO transsimp set ? ",
                        transimp,
                        (err, result, fields) => {
                          if (err) {
                            return db.rollback(() => {
                              reject("Transaksi penarikan simpanan gagal");
                            });
                          }
                          resolve({
                            NTRANS: NTRANS,
                            KTRANS: "1102",
                            KBT: param.KBT,
                            NBT: NTRANS,
                            BT:
                              param.KBT +
                              "/" +
                              moment(new Date()).format("MM") +
                              "/" +
                              NTRANS,
                            TANGGAL: moment(new Date()).format(),
                            ACC: ACC_SIMPANAN.ACC,
                            KETACC: ACC_SIMPANAN.KETERANGAN,
                            KETERANGAN: param.KETERANGAN,
                            DEBET: parseFloat(e.NOMINAL),
                            KREDIT: 0,
                            ST: 2,
                            PRT: 0,
                            UID: param.UID,
                            KU: param.KU,
                            CIF: param.CIF,
                            UID_APV: param.UID
                          });
                        }
                      );
                    }
                  );
                }
              );
            })
            .catch(err => {
              return db.rollback(() => {
                reject("Transaksi penarikan simpanan gagal");
              });
            });
        });
        queue.push(antrian);
      });
      Promise.all(queue)
        .then(data => {
          transaction = data;
          transaction.push({
            NTRANS: NTRANS,
            KTRANS: "1102",
            KBT: param.KBT,
            NBT: NTRANS,
            BT:
              param.KBT + "/" + moment(new Date()).format("MM") + "/" + NTRANS,
            TANGGAL: moment(new Date()).format(),
            ACC: ACC_KAS_BANK.ACC,
            KETACC: ACC_KAS_BANK.KETERANGAN,
            KETERANGAN: param.KETERANGAN,
            DEBET: 0,
            KREDIT: parseFloat(param.NOMINAL),
            ST: 2,
            PRT: 0,
            UID: param.UID,
            KU: param.KU,
            CIF: param.CIF,
            UID_APV: param.UID
          });
          multipleInsert(db, "transaksi", transaction, (err, result) => {
            if (err) {
              return db.rollback(() => {
                reject("Transaksi penarikan simpanan gagal");
              });
            }
            db.commit(function(err) {
              if (err) {
                return db.rollback(() => {
                  reject(err);
                });
              }
              resolve(transaction);
            });
          });
        })
        .catch(err => {
          reject("Transaksi penarikan simpanan gagal");
        });
    });
  });
};

const pendebetan_simpanan = param => {
  return new Promise((resolve, reject) => {
    if (param.transaksi.filter(x => parseInt(x.NOMINAL) > 0).length <= 0) {
      reject("Tidak ada transaksi yang di proses!");
    }
    var transaction = [];
    let NBT;
    let ACC_SIMPANAN;
    let ACC_KAS_BANK;
    let NTRANS;
    let transimp = [];
    db.beginTransaction(err => {
      let queue = [];
      param.transaksi.forEach(e => {
        let antrian = new Promise((resolve, reject) => {
          cariSimpanan({ NOSIMP: e.NOSIMP, KU: param.KU, CIF: param.CIF })
            .then(data => {
              if (err) {
                return db.rollback(() => {
                  reject("Transaksi pendebetan simpanan  gagal");
                });
              }
              db.query(
                "UPDATE mastersimp SET kredit = ? , saldo = ? where NOSIMP = ? AND KU = ? AND CIF = ?",
                [
                  data.KREDIT - parseFloat(e.NOMINAL),
                  data.SALDO - parseFloat(e.NOMINAL),
                  e.NOSIMP,
                  param.KU,
                  param.CIF
                ],
                (err, result) => {
                  if (err) {
                    return db.rollback(() => {
                      reject("Transaksi pendebetan simpanan gagal");
                    });
                  }
                  let query =
                    "SELECT max(NBT) as NBT from transaksi WHERE cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;SELECT ACC,KETERANGAN from account WHERE ACC = ? and KU = ? and cif = ? limit 1;";
                  db.query(
                    query,
                    [
                      param.CIF,
                      data.ACC,
                      param.KU,
                      param.CIF,
                      param.ACC,
                      param.KU,
                      param.CIF
                    ],
                    (err, result) => {
                      NBT = !result[0][0].NBT ? 0 : result[0][0].NBT;
                      ACC_SIMPANAN = result[1][0];
                      ACC_KAS_BANK = result[2][0];
                      NTRANS = parseInt(NBT)
                        .add(1)
                        .pad(7);
                      transimp.push({
                        TANGGAL: moment(new Date()).format(),
                        NTRANS: NTRANS,
                        NOSIMP: data.NOSIMP,
                        TGLSETOR: moment(new Date()).format(),
                        KETERANGAN: param.KETERANGAN || "-",
                        BERITA: param.BERITA || "-",
                        DEBET: 0,
                        KREDIT: e.NOMINAL,
                        ST: 2,
                        SALDO: data.SALDO - parseFloat(e.NOMINAL),
                        UID: param.UID,
                        KU: param.KU,
                        CIF: param.CIF
                      });
                      transaction.push({
                        NTRANS: NTRANS,
                        KTRANS: "1112",
                        KBT: param.KBT,
                        NBT: NTRANS,
                        BT:
                          param.KBT +
                          "/" +
                          moment(new Date()).format("MM") +
                          "/" +
                          NTRANS,
                        TANGGAL: moment(new Date()).format(),
                        ACC: ACC_SIMPANAN.ACC,
                        KETACC: ACC_SIMPANAN.KETERANGAN,
                        KETERANGAN: param.KETERANGAN,
                        DEBET: parseFloat(e.NOMINAL),
                        KREDIT: 0,
                        ST: 2,
                        PRT: 0,
                        UID: param.UID,
                        KU: param.KU,
                        CIF: param.CIF,
                        UID_APV: param.UID
                      });
                      resolve("oke");
                    }
                  );
                }
              );
            })
            .catch(err => {
              return db.rollback(() => {
                reject("Transaksi pendebetan simpanan gagal");
              });
            });
        });
        queue.push(antrian);
      });
      Promise.all(queue)
        .then(data => {
          transaction.push({
            NTRANS: NTRANS,
            KTRANS: "1112",
            KBT: param.KBT,
            NBT: NTRANS,
            BT:
              param.KBT + "/" + moment(new Date()).format("MM") + "/" + NTRANS,
            TANGGAL: moment(new Date()).format(),
            ACC: ACC_KAS_BANK.ACC,
            KETACC: ACC_KAS_BANK.KETERANGAN,
            KETERANGAN: param.KETERANGAN,
            DEBET: 0,
            KREDIT: parseFloat(param.NOMINAL),
            ST: 2,
            PRT: 0,
            UID: param.UID,
            KU: param.KU,
            CIF: param.CIF,
            UID_APV: param.UID
          });
          multipleInsert(db, "transsimp", transimp, (err, result) => {
            if (err) {
              return db.rollback(() => {
                reject("Transaksi pendebetan simpanan gagal");
              });
            }
            multipleInsert(db, "transaksi", transaction, (err, result) => {
              if (err) {
                return db.rollback(() => {
                  reject("Transaksi pendebetan simpanan gagal");
                });
              }
              db.commit(function(err) {
                if (err) {
                  return db.rollback(() => {
                    reject(err);
                  });
                }
                resolve(transaction);
              });
            });
          });
        })
        .catch(err => {
          reject("Transaksi pendebetan simpanan gagal");
        });
    });
  });
};
const createSimpanan = simpanan => {
  return new Promise((resolve, reject) => {
    db.query("INSERT INTO mastersimp set ? ", simpanan, function(
      err,
      result,
      fields
    ) {
      // if any error while executing above query, throw error
      if (err) {
        reject(err);
      }
      resolve(simpanan);
    });
  });
};

/**
 * Update Agama
 */
const updateSimpanan = (simpanan, CIF) => {
  return new Promise((resolve, reject) => {
    db.query(
      "UPDATE mastersimp SET ACC=?, TGLBUKA=?, TGLAKTIF=?, DEBET=?, KREDIT=?, SALDO=?, BLOKIR=?, KU=?,where NOSIMP = ? AND CIF = ? ",
      [
        simpanan.ACC,
        simpanan.TGLBUKA,
        simpanan.TGLAKTIF,
        simpanan.DEBET,
        simpanan.KREDIT,
        simpanan.SALDO,
        simpanan.BLOKIR,
        simpanan.KU,
        simpanan.NOSIMP,
        CIF
      ],
      function(err, results, fields) {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      }
    );
  });
};

/**
 * delete agama
 */
const deleteSimpanan = simpanan => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM mastersimp WHERE NOSIMP = ?,KU = ? AND CIF = ?",
      [simpanan.NOSIMP, simpanan.KU, simpanan.CIF],
      function(err, result, fields) {
        if (err) {
          reject(err);
        }
        resolve(result);
      }
    );
  });
};

module.exports = {
  findAllSimpanan: findAllSimpanan,
  createSimpanan: createSimpanan,
  updateSimpanan: updateSimpanan,
  deleteSimpanan: deleteSimpanan,
  cariSimpanan: cariSimpanan,
  setoran_pokok: setoran_pokok,
  setoran_per_anggota: setoran_per_anggota,
  pendebetan_simpanan: pendebetan_simpanan,
  penarikan_simpanan: penarikan_simpanan,
  pengkreditan_simpanan: pengkreditan_simpanan,
  pengkreditan_bunga_jasa: pengkreditan_bunga_jasa,
  pendebetan_biaya_admin: pendebetan_biaya_admin
};
