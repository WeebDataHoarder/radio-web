  let md5_init = null;
  let md5_update = null;
  let md5_final = null;
  let md5_free = null;
  Module["onRuntimeInitialized"] = function(){
    /*
    typedef unsigned int MD5_u32plus;

    typedef struct {
      MD5_u32plus lo, hi;
      MD5_u32plus a, b, c, d;
      unsigned char buffer[64];
      MD5_u32plus block[16];
    } MD5_CTX;


    extern MD5_CTX * MD5_Init();
    extern void MD5_Update(MD5_CTX *ctx, const void *data, unsigned long size);
    //result will be 16 bytes long
    extern void MD5_Final(MD5_CTX *ctx, unsigned char *result);
    */
    md5_init = Module.cwrap('MD5_Init', 'number', []);
    md5_update = Module.cwrap('MD5_Update', null, ['number', 'number', 'number']);
    md5_final = Module.cwrap('MD5_Final', null, ['number', 'number']);
    md5_free = Module.cwrap('MD5_Free', null, ['number']);
  };
